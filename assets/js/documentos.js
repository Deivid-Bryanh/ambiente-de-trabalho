
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { supabase } from "./supabase.js";

// Autenticação
const { data: { session }, error: sessionError } =
    await supabase.auth.getSession();

if (sessionError || !session) {
    window.location.replace("./index.html");
}

// Elementos
const imageFiles = document.getElementById("imageFiles");
const mergeFiles = document.getElementById("mergeFiles");
const splitFile = document.getElementById("splitFile");
const pageRanges = document.getElementById("pageRanges");

const imageButton = document.getElementById("imageToPdfButton");
const mergeButton = document.getElementById("mergeButton");
const splitButton = document.getElementById("splitButton");

const individualOption = document.getElementById("individualOption");
const rangesOption = document.getElementById("rangesOption");
const individualDescription = document.getElementById("individualDescription");
const rangesDescription = document.getElementById("rangesDescription");

let splitMode = "individual";
let splitPageCount = 0;

// Mensagens
function showMessage(id, message, type = "") {
    const element = document.getElementById(id);
    element.textContent = message;
    element.className = `tool-message ${type}`;
}

function setButtonLoading(button, loading, loadingText, normalText) {
    button.disabled = loading;
    button.textContent = loading ? loadingText : normalText;
}

function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadFile(bytes, filename, mimeType) {
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function safeFilename(name) {
    return name
        .replace(/\.[^.]+$/, "")
        .replace(/[^\p{L}\p{N}_-]+/gu, "_")
        .slice(0, 80) || "documento";
}

function isPdf(file) {
    return file &&
        (file.type === "application/pdf" ||
         file.name.toLowerCase().endsWith(".pdf"));
}

// Atualiza informações dos arquivos selecionados
imageFiles.addEventListener("change", () => {
    const files = Array.from(imageFiles.files);

    document.getElementById("imageFileInfo").textContent =
        files.length
            ? `${files.length} imagem(ns) selecionada(s).`
            : "Nenhuma imagem selecionada.";

    showMessage("imageMessage", "");
});

mergeFiles.addEventListener("change", () => {
    const files = Array.from(mergeFiles.files);

    document.getElementById("mergeFileInfo").textContent =
        files.length
            ? files.map(file => file.name).join(", ")
            : "Nenhum PDF selecionado.";

    showMessage("mergeMessage", "");
});

// Seleção do PDF para dividir
splitFile.addEventListener("change", async () => {
    const file = splitFile.files[0];

    splitPageCount = 0;

    showMessage("splitMessage", "");

    if (!file) {
        document.getElementById("splitFileInfo").textContent =
            "Nenhum PDF selecionado.";

        document.getElementById("splitSummary").textContent =
            "Selecione um PDF acima para começar.";

        return;
    }

    if (!isPdf(file)) {
        document.getElementById("splitFileInfo").textContent =
            "Arquivo inválido.";

        document.getElementById("splitSummary").textContent =
            "Selecione um documento PDF válido.";

        showMessage("splitMessage", "O arquivo selecionado não é um PDF.", "error");
        splitFile.value = "";
        return;
    }

    document.getElementById("splitFileInfo").textContent =
        `${file.name} • ${formatFileSize(file.size)}`;

    document.getElementById("splitSummary").textContent =
        "Analisando documento...";

    try {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);

        splitPageCount = pdf.getPageCount();

        updateSplitSummary();

    } catch (error) {
        document.getElementById("splitSummary").textContent =
            "Não foi possível ler este PDF.";

        showMessage(
            "splitMessage",
            "Erro ao abrir o PDF. Verifique se ele não está corrompido ou protegido por senha. " + error.message,
            "error"
        );
    }
});

// Resumo da divisão
function updateSplitSummary() {
    const summary = document.getElementById("splitSummary");

    if (!splitPageCount) {
        summary.textContent = "Selecione um PDF acima para começar.";
        return;
    }

    if (splitMode === "individual") {
        summary.textContent =
            `Seu documento possui ${splitPageCount} página(s). ` +
            `Serão criados ${splitPageCount} arquivos PDF individuais, reunidos em um ZIP.`;

        return;
    }

    summary.textContent =
        `Seu documento possui ${splitPageCount} página(s). ` +
        "Informe os intervalos abaixo para definir os arquivos que serão gerados.";
}

// Alternar modo de divisão
function selectSplitMode(mode) {
    splitMode = mode;

    individualOption.classList.toggle("active", mode === "individual");
    rangesOption.classList.toggle("active", mode === "ranges");

    individualDescription.hidden = mode !== "individual";
    rangesDescription.hidden = mode !== "ranges";

    splitButton.textContent =
        mode === "individual"
            ? "Separar todas as páginas"
            : "Dividir por intervalos";

    showMessage("splitMessage", "");
    updateSplitSummary();
}

individualOption.addEventListener("click", () => {
    selectSplitMode("individual");
});

rangesOption.addEventListener("click", () => {
    selectSplitMode("ranges");
});

pageRanges.addEventListener("input", () => {
    showMessage("splitMessage", "");
});

// Converte uma expressão como 1-3, 4-7, 8-10 em intervalos.
function parseRanges(value, totalPages) {
    if (!value.trim()) {
        throw new Error("Informe os intervalos desejados.");
    }

    const parts = value.split(",").map(part => part.trim());

    if (parts.some(part => !part)) {
        throw new Error("Existe um intervalo vazio. Confira a separação por vírgulas.");
    }

    const ranges = [];
    const usedPages = new Set();

    for (const part of parts) {
        const match = part.match(/^(\d+)\s*-\s*(\d+)$/);

        if (!match) {
            throw new Error(
                `Intervalo "${part}" inválido. Utilize o formato 1-3, 4-7.`
            );
        }

        const start = Number(match[1]);
        const end = Number(match[2]);

        if (
            !Number.isInteger(start) ||
            !Number.isInteger(end) ||
            start < 1 ||
            end > totalPages ||
            start > end
        ) {
            throw new Error(
                `O intervalo ${part} é inválido. O documento possui ${totalPages} página(s).`
            );
        }

        for (let page = start; page <= end; page++) {
            if (usedPages.has(page)) {
                throw new Error(
                    `A página ${page} aparece em mais de um intervalo. Remova a repetição.`
                );
            }

            usedPages.add(page);
        }

        ranges.push({ start, end });
    }

    return ranges;
}

// Cria um PDF a partir de uma lista de páginas (índices começando em zero).
async function createPdfFromPages(sourcePdf, pageIndexes) {
    const newPdf = await PDFDocument.create();

    const copiedPages = await newPdf.copyPages(
        sourcePdf,
        pageIndexes
    );

    copiedPages.forEach(page => newPdf.addPage(page));

    return await newPdf.save();
}

// Gera ZIP contendo vários PDFs.
async function generateZip(pdfFiles, zipName) {
    const zip = new JSZip();

    for (const item of pdfFiles) {
        zip.file(item.name, item.bytes);
    }

    const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
            level: 5
        }
    });

    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");

    link.href = url;
    link.download = zipName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Imagem para PDF
imageButton.addEventListener("click", async () => {
    const files = Array.from(imageFiles.files);

    if (!files.length) {
        showMessage("imageMessage", "Selecione pelo menos uma imagem.", "error");
        return;
    }

    setButtonLoading(imageButton, true, "Convertendo...", "Converter para PDF");

    try {
        const pdf = await PDFDocument.create();

        for (const file of files) {
            if (!file.type.startsWith("image/")) {
                throw new Error(`${file.name} não é uma imagem válida.`);
            }

            let image;
            const bytes = await file.arrayBuffer();

            if (file.type === "image/png") {
                image = await pdf.embedPng(bytes);

            } else if (
                file.type === "image/jpeg" ||
                file.type === "image/jpg"
            ) {
                image = await pdf.embedJpg(bytes);

            } else {
                const bitmap = await createImageBitmap(file);
                const canvas = document.createElement("canvas");

                canvas.width = bitmap.width;
                canvas.height = bitmap.height;

                const context = canvas.getContext("2d");
                context.drawImage(bitmap, 0, 0);
                bitmap.close();

                const convertedBlob = await new Promise(resolve =>
                    canvas.toBlob(resolve, "image/jpeg", 0.92)
                );

                if (!convertedBlob) {
                    throw new Error(`Não foi possível converter ${file.name}.`);
                }

                image = await pdf.embedJpg(
                    await convertedBlob.arrayBuffer()
                );
            }

            const page = pdf.addPage([image.width, image.height]);

            page.drawImage(image, {
                x: 0,
                y: 0,
                width: image.width,
                height: image.height
            });
        }

        const result = await pdf.save();

        downloadFile(result, "imagens-convertidas.pdf", "application/pdf");

        showMessage(
            "imageMessage",
            "PDF criado e baixado com sucesso!",
            "success"
        );

    } catch (error) {
        showMessage("imageMessage", error.message, "error");

    } finally {
        setButtonLoading(imageButton, false, "", "Converter para PDF");
    }
});

// Mesclar PDFs
mergeButton.addEventListener("click", async () => {
    const files = Array.from(mergeFiles.files);

    if (files.length < 2) {
        showMessage("mergeMessage", "Selecione pelo menos dois PDFs.", "error");
        return;
    }

    if (files.some(file => !isPdf(file))) {
        showMessage("mergeMessage", "Todos os arquivos devem ser PDFs.", "error");
        return;
    }

    setButtonLoading(mergeButton, true, "Mesclando...", "Mesclar documentos");

    try {
        const mergedPdf = await PDFDocument.create();

        for (const file of files) {
            const bytes = await file.arrayBuffer();
            const sourcePdf = await PDFDocument.load(bytes);

            const pages = await mergedPdf.copyPages(
                sourcePdf,
                sourcePdf.getPageIndices()
            );

            pages.forEach(page => mergedPdf.addPage(page));
        }

        const result = await mergedPdf.save();

        downloadFile(result, "documentos-mesclados.pdf", "application/pdf");

        showMessage(
            "mergeMessage",
            "Documentos mesclados com sucesso!",
            "success"
        );

    } catch (error) {
        showMessage(
            "mergeMessage",
            "Não foi possível mesclar os PDFs. Verifique se os arquivos estão válidos e não possuem senha. " + error.message,
            "error"
        );

    } finally {
        setButtonLoading(mergeButton, false, "", "Mesclar documentos");
    }
});

// Dividir PDFs
splitButton.addEventListener("click", async () => {
    const file = splitFile.files[0];

    if (!file) {
        showMessage("splitMessage", "Selecione um PDF primeiro.", "error");
        return;
    }

    if (!isPdf(file)) {
        showMessage("splitMessage", "Selecione um arquivo PDF válido.", "error");
        return;
    }

    setButtonLoading(splitButton, true, "Processando documento...", "Dividir PDF");

    try {
        const bytes = await file.arrayBuffer();

        const sourcePdf = await PDFDocument.load(bytes);
        const totalPages = sourcePdf.getPageCount();

        if (totalPages === 0) {
            throw new Error("Este PDF não possui páginas.");
        }

        const baseName = safeFilename(file.name);
        const outputFiles = [];

        if (splitMode === "individual") {
            for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                setButtonLoading(
                    splitButton,
                    true,
                    `Separando página ${pageIndex + 1} de ${totalPages}...`,
                    "Dividir PDF"
                );

                const pdfBytes = await createPdfFromPages(
                    sourcePdf,
                    [pageIndex]
                );

                outputFiles.push({
                    name: `pagina-${String(pageIndex + 1).padStart(3, "0")}.pdf`,
                    bytes: pdfBytes
                });
            }

        } else {
            const ranges = parseRanges(pageRanges.value, totalPages);

            for (let index = 0; index < ranges.length; index++) {
                const range = ranges[index];

                setButtonLoading(
                    splitButton,
                    true,
                    `Criando arquivo ${index + 1} de ${ranges.length}...`,
                    "Dividir PDF"
                );

                const pageIndexes = [];

                for (let page = range.start; page <= range.end; page++) {
                    pageIndexes.push(page - 1);
                }

                const pdfBytes = await createPdfFromPages(
                    sourcePdf,
                    pageIndexes
                );

                outputFiles.push({
                    name: `paginas-${range.start}-a-${range.end}.pdf`,
                    bytes: pdfBytes
                });
            }
        }

        if (!outputFiles.length) {
            throw new Error("Nenhum arquivo foi gerado.");
        }

        setButtonLoading(
            splitButton,
            true,
            "Preparando download...",
            "Dividir PDF"
        );

        await generateZip(
            outputFiles,
            `${baseName}-dividido.zip`
        );

        showMessage(
            "splitMessage",
            `Concluído! ${outputFiles.length} arquivo(s) PDF foram criados e reunidos em um ZIP.`,
            "success"
        );

    } catch (error) {
        showMessage(
            "splitMessage",
            error.message || "Ocorreu um erro ao dividir o PDF.",
            "error"
        );

    } finally {
        splitButton.disabled = false;
        splitButton.textContent =
            splitMode === "individual"
                ? "Separar todas as páginas"
                : "Dividir por intervalos";
    }
});

// Inicialização
selectSplitMode("individual");
