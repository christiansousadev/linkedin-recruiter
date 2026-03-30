import express from "express";
import cors from "cors";
import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import ExcelJS from "exceljs";
import fs from "fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import dotenv from "dotenv";

dotenv.config();
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());
app.use(cors());

function REGISTER_AUDIT_LOG(level, action, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    module: "LINKEDIN_SCRAPER",
    action,
    ...details
  };
  const logString = JSON.stringify(logEntry);

  // envia para o console
  if (level === "error") {
    console.error(logString);
  } else {
    console.log(logString);
  }

  // persiste o log silenciosamente para o dashboard consumir
  fs.appendFile("audit_logs.jsonl", logString + "\n").catch(() => {});
}

// GERA O ARQUIVO EXCEL EM BASE64
async function GENERATE_EXCEL_BASE64(data) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Talentos");

  sheet.columns = [
    { header: "Nome", key: "name", width: 25 },
    { header: "Telefone", key: "phone", width: 20 },
    { header: "E-mail", key: "email", width: 30 },
    { header: "Cargo Atual", key: "headline", width: 40 },
    { header: "Resumo", key: "summary", width: 60 },
    { header: "Experiência Profissional", key: "experience", width: 60 },
    { header: "Formação Acadêmica", key: "education", width: 40 },
    { header: "Licenças e Certificados", key: "certifications", width: 50 },
    { header: "Competências (Skills)", key: "skills", width: 50 },
    { header: "Localização", key: "location", width: 25 },
    { header: "URL", key: "profileUrl", width: 40 }
  ];

  sheet.addRows(data);
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer.toString("base64");
}

// PARSEIA O TEXTO EXTRAÍDO DO PDF DO LINKEDIN
function PARSE_LINKEDIN_PDF(rawText, candidateName = "") {
  const lines = rawText
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .filter(l => !/^(Page|of|\d+)$/.test(l));

  const result = {
    name: "Não Informado",
    phone: "Não Informado",
    email: "Não Informado",
    headline: "Não Informado",
    location: "Não Informado",
    summary: "Não Informado",
    experience: "Não Informado",
    education: "Não Informado",
    certifications: "Não Informado",
    skills: "Não Informado"
  };

  const findIdx = pattern => lines.findIndex(l => pattern.test(l));

  const idxContact = findIdx(/^Contato$/i);
  const idxSkills = findIdx(/^Principais competências$/i);
  const idxCerts = findIdx(/^Certifications?$|^Licenças e certificados$/i);
  const idxSummary = findIdx(/^Resumo$/i);
  const idxExp = findIdx(/^Experiência$/i);
  const idxEdu = findIdx(/^Formação acadêmica$/i);

  // CONTATO
  if (idxContact !== -1) {
    const contactEnd =
      idxSkills !== -1
        ? idxSkills
        : idxSummary !== -1
          ? idxSummary
          : lines.length;
    for (const l of lines.slice(idxContact + 1, contactEnd)) {
      if (
        /^\+?\(?\d[\d\s\-().]{6,}/.test(l) &&
        result.phone === "Não Informado"
      )
        result.phone = l;
      if (
        /@/.test(l) &&
        /\.\w{2,}/.test(l) &&
        !l.includes("linkedin") &&
        result.email === "Não Informado"
      )
        result.email = l;
    }
  }

  // SKILLS
  if (idxSkills !== -1) {
    const skillsEnd =
      idxCerts !== -1
        ? idxCerts
        : idxSummary !== -1
          ? idxSummary
          : lines.length;
    result.skills =
      lines
        .slice(idxSkills + 1, skillsEnd)
        .filter(
          l =>
            l.length > 1 &&
            l.length < 80 &&
            !/^(Languages?|Idiomas|Certifications?|Licenças)$/i.test(l)
        )
        .join(" | ") || "Não Informado";
  }

  // constroi uma âncora dinâmica para não depender apenas do resumo
  const anchorIdx =
    idxSummary !== -1
      ? idxSummary
      : idxExp !== -1
        ? idxExp
        : idxEdu !== -1
          ? idxEdu
          : lines.length;

  const isLocation = line => {
    const parts = line.split(",").map(p => p.trim());
    return (
      parts.length >= 2 &&
      parts.length <= 3 &&
      line.length <= 60 &&
      parts.every(p => p.split(" ").length <= 4)
    );
  };

  const locLine = lines[anchorIdx - 1] || "";
  result.location = isLocation(locLine) ? locLine : "Não Informado";

  const contentEnd = isLocation(locLine) ? anchorIdx - 1 : anchorIdx;
  const certsStart =
    idxCerts !== -1 ? idxCerts + 1 : idxSkills !== -1 ? idxSkills + 1 : 0;

  const isName = l => {
    const words = l.trim().split(/\s+/);
    return (
      l.length < 50 &&
      !/[|,]/.test(l) &&
      !/\d{4}/.test(l) &&
      l !== l.toUpperCase() &&
      words.length >= 2 &&
      words.length <= 5 &&
      !/^(Talent|Excel|Python|Data|Power|Business|Machine|Cloud|Agile|Scrum)$/i.test(
        words[0]
      ) &&
      words.every(w => /^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÄËÏÖÜ][a-záéíóúàâêôãõçäëïöü]/.test(w))
    );
  };

  const block = lines.slice(certsStart, contentEnd).filter(l => l.length > 1);
  const searchName = candidateName?.toLowerCase().trim() ?? "";

  const nameIdx = searchName
    ? block.findIndex(l => l.toLowerCase().trim() === searchName)
    : block.findIndex(isName);

  if (nameIdx !== -1) {
    result.certifications =
      block.slice(0, nameIdx).join(" | ") || "Não Informado";
    result.name = block[nameIdx];
    result.headline = block.slice(nameIdx + 1).join(" ") || "Não Informado";
  } else {
    result.certifications = block.join(" | ") || "Não Informado";
    if (candidateName) {
      result.name = candidateName;
    }
  }

  // RESUMO
  if (idxSummary !== -1) {
    const summaryEnd =
      [idxExp, idxEdu].filter(i => i > idxSummary).sort((a, b) => a - b)[0] ??
      lines.length;
    result.summary =
      lines
        .slice(idxSummary + 1, summaryEnd)
        .join(" ")
        .trim() || "Não Informado";
  }

  // EXPERIÊNCIA
  if (idxExp !== -1) {
    const expEnd = idxEdu !== -1 && idxEdu > idxExp ? idxEdu : lines.length;
    result.experience =
      lines
        .slice(idxExp + 1, expEnd)
        .join(" | ")
        .trim() || "Não Informado";
  }

  // FORMAÇÃO ACADÊMICA
  if (idxEdu !== -1) {
    result.education =
      lines
        .slice(idxEdu + 1)
        .join(" | ")
        .trim() || "Não Informado";
  }

  return result;
}

// BAIXA O PDF DO PERFIL VIA PLAYWRIGHT
async function DOWNLOAD_PROFILE_PDF(page, profileUrl) {
  await page.goto(profileUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });

  // Aguarda a seção de ações do perfil carregar
  // O botão "Mais" do perfil só aparece após o card principal renderizar
  await page.waitForTimeout(3000);

  // Configura captura do download ANTES dos cliques
  const downloadPromise = page.waitForEvent("download", { timeout: 40000 });

  // foca no conteudo principal para ignorar a barra de navegação
  const moreBtn = page
    .locator("main")
    .locator('button[aria-label="Mais"]')
    .first();

  // Garante que o botão está visível antes de clicar
  await moreBtn.waitFor({ state: "visible", timeout: 15000 });
  await moreBtn.click();

  // Aguarda o dropdown e clica em "Salvar como PDF"
  // Debug confirmou: role="menuitem", texto interno "Salvar como PDF"
  const pdfMenuItem = page
    .locator('[role="menuitem"]')
    .filter({ hasText: "Salvar como PDF" });
  await pdfMenuItem.waitFor({ state: "visible", timeout: 10000 });
  await pdfMenuItem.click();

  // Captura o download
  const download = await downloadPromise;
  const tmpPath = await download.path();
  if (!tmpPath) throw new Error("Caminho do PDF não disponível");

  const buffer = await fs.readFile(tmpPath);
  return buffer;
}

// EXTRAI TEXTO DO BUFFER PDF USANDO PDFJS-DIST
async function extractTextFromPDF(buffer) {
  const uint8 = new Uint8Array(buffer);
  const doc = await getDocument({ data: uint8 }).promise;
  let text = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const pdfPage = await doc.getPage(p);
    const items = await pdfPage.getTextContent();
    text += items.items.map(s => s.str).join("\n") + "\n";
  }
  return text;
}

// EXECUTA A EXTRAÇÃO E EMITE EVENTOS DE PROGRESSO
async function SCRAPE_LINKEDIN_URL(
  searchUrl,
  cookie,
  maxPages,
  emitEvent,
  req
) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    acceptDownloads: true,
    locale: "pt-BR"
  });

  await context.addCookies([
    { name: "li_at", value: cookie, domain: ".www.linkedin.com", path: "/" }
  ]);

  const page = await context.newPage();
  let allCandidates = [];
  let uniqueCandidates = [];

  // flag para travar os loops se o frontend fechar a conexão
  let isCancelled = false;
  req.on("close", () => {
    isCancelled = true;
  });

  try {
    for (let i = 1; i <= maxPages; i++) {
      if (isCancelled) {
        REGISTER_AUDIT_LOG("warn", "CLIENT_DISCONNECTED", {
          phase: "MAPPING",
          page: i
        });
        break;
      }

      emitEvent({
        type: "progress",
        percent: (i / maxPages) * 20,
        text: `mapeando página ${i} de ${maxPages}...`
      });

      const pageUrl = searchUrl.includes("page=")
        ? searchUrl.replace(/page=\d+/, `page=${i}`)
        : `${searchUrl}&page=${i}`;

      REGISTER_AUDIT_LOG("info", "MAPPING_PAGE", { pageUrl, page: i });

      await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      try {
        await page.waitForSelector('a[href*="/in/"]', { timeout: 15000 });
      } catch (e) {
        REGISTER_AUDIT_LOG("warn", "NO_RESULTS_FOUND", { page: i });
        break;
      }

      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      const data = await page.evaluate(() => {
        const seen = new Set();
        return Array.from(document.querySelectorAll('a[href*="/in/"]')).reduce(
          (acc, a) => {
            const url = a.href.split("?")[0].replace(/\/$/, "");
            if (!url.match(/\/in\/[\w-]+$/) || seen.has(url)) return acc;
            seen.add(url);

            const li =
              a.closest("li") ||
              a.closest("[data-view-name]") ||
              a.parentElement;
            const nameEl = li?.querySelector('span[aria-hidden="true"]') || a;
            const name = nameEl.innerText
              .trim()
              .split("\n")[0]
              .replace(/•\s*\d+º/g, "")
              .trim();

            if (!name || name.length < 2) return acc;
            acc.push({ name, profileUrl: url });
            return acc;
          },
          []
        );
      });

      allCandidates.push(...data);
      await page.waitForTimeout(Math.floor(Math.random() * 3000) + 2000);
    }

    uniqueCandidates = Array.from(
      new Map(allCandidates.map(item => [item.profileUrl, item])).values()
    );
    const totalCands = uniqueCandidates.length;
    REGISTER_AUDIT_LOG("info", "MAPPING_COMPLETE", {
      totalCandidates: totalCands
    });

    for (let i = 0; i < totalCands; i++) {
      if (isCancelled) {
        REGISTER_AUDIT_LOG("warn", "CLIENT_DISCONNECTED", {
          phase: "EXTRACTION",
          candidateIndex: i
        });
        break;
      }

      const candidate = uniqueCandidates[i];
      const progressPercent = 20 + (i / totalCands) * 75;

      emitEvent({
        type: "progress",
        percent: progressPercent,
        text: `extraindo PDF ${i + 1}/${totalCands}: ${candidate.name}`
      });

      try {
        const pdfBuffer = await DOWNLOAD_PROFILE_PDF(
          page,
          candidate.profileUrl
        );
        const rawText = await extractTextFromPDF(pdfBuffer);
        const parsed = PARSE_LINKEDIN_PDF(rawText, candidate.name);

        candidate.phone = parsed.phone;
        candidate.email = parsed.email;
        candidate.headline = parsed.headline;
        candidate.location = parsed.location;
        candidate.summary = parsed.summary;
        candidate.experience = parsed.experience;
        candidate.education = parsed.education;
        candidate.certifications = parsed.certifications;
        candidate.skills = parsed.skills;

        REGISTER_AUDIT_LOG("info", "PDF_EXTRACTED", {
          candidateName: candidate.name,
          status: "success"
        });
      } catch (pdfErr) {
        REGISTER_AUDIT_LOG("error", "PDF_EXTRACTION_FAILED", {
          candidateName: candidate.name,
          error: pdfErr.message.split("\n")[0]
        });
        candidate.phone = "Erro";
        candidate.email = "Erro";
        candidate.headline = "Erro ao baixar PDF";
        candidate.location = "Erro";
        candidate.summary = "Erro";
        candidate.experience = "Erro";
        candidate.education = "Erro";
        candidate.certifications = "Erro";
        candidate.skills = "Erro";
      }

      await page.waitForTimeout(Math.floor(Math.random() * 4000) + 3000);
    }
  } catch (fatalError) {
    REGISTER_AUDIT_LOG("error", "FATAL_EXTRACTION_ERROR", {
      error: fatalError.message
    });
  } finally {
    await browser.close();
  }

  // retorna o que conseguiu capturar ate o momento da interrupção
  return uniqueCandidates;
}

app.post("/api/scrape", async (req, res) => {
  const { searchUrl, liAtCookie, maxPages = 1 } = req.body;

  if (!searchUrl || !liAtCookie) {
    REGISTER_AUDIT_LOG("error", "VALIDATION_FAILED", {
      reason: "missing parameters"
    });
    return res.status(400).json({ error: "url ou token ausentes" });
  }

  req.setTimeout(0);
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.socket?.setNoDelay(true); // desativa o algoritmo de Nagle do TCP
  // força o envio dos headers imediatamente
  res.flushHeaders();

  const emitEvent = data => {
    if (!res.writableEnded) {
      res.write(JSON.stringify(data) + "\n");
      // força o flush imediato do socket
      if (typeof res.flush === "function") res.flush();
    }
  };

  // Heartbeat para evitar que o navegador encerre o fetch stream por inatividade TCP
  const heartbeat = setInterval(() => {
    if (!req.closed) res.write(" \n");
  }, 15000);

  req.on("close", () => clearInterval(heartbeat));

  try {
    REGISTER_AUDIT_LOG("info", "SCRAPE_STARTED", { searchUrl, maxPages });
    emitEvent({ type: "start", text: "inicializando robô..." });

    // req para o scraper conseguir ouvir o evento de close
    const data = await SCRAPE_LINKEDIN_URL(
      searchUrl,
      liAtCookie,
      maxPages,
      emitEvent,
      req
    );

    emitEvent({ type: "progress", percent: 98, text: "gerando planilha..." });

    const excelBase64 = await GENERATE_EXCEL_BASE64(data);
    emitEvent({ type: "complete", data, excelBase64 });
    REGISTER_AUDIT_LOG("info", "SCRAPE_COMPLETED", {
      recordsProcessed: data.length
    });

    clearInterval(heartbeat);
    if (!req.closed) res.end();
  } catch (error) {
    clearInterval(heartbeat);
    REGISTER_AUDIT_LOG("error", "SYSTEM_FAILURE", {
      error: error.message,
      stack: error.stack
    });
    emitEvent({ type: "error", text: "falha interna no processamento" });
    if (!req.closed) res.end();
  }
});

app.get("/api/logs", async (req, res) => {
  try {
    const data = await fs.readFile("audit_logs.jsonl", "utf-8");
    const logs = data
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line))
      .reverse();
    res.json(logs);
  } catch (error) {
    res.json([]);
  }
});

app.delete("/api/logs", async (req, res) => {
  try {
    await fs.writeFile("audit_logs.jsonl", "");
    REGISTER_AUDIT_LOG("info", "LOGS_CLEARED", { source: "dashboard" });
    res.status(200).json({ message: "sucesso" });
  } catch (error) {
    res.status(500).json({ error: "falha ao limpar logs" });
  }
});

app.listen(3001, () => {
  REGISTER_AUDIT_LOG("info", "SERVER_STARTED", { port: 3001 });
});
