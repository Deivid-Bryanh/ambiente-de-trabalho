
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { supabase } from "./supabase.js";

import mammoth from "https://esm.sh/mammoth@1.9.0";
import html2pdf from "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.3/dist/html2pdf.bundle.min.js";

import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.10.38";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

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
// ==========================================
// WORD PARA PDF
// ==========================================

const wordFile = document.getElementById("wordFile");
const wordButton = document.getElementById("wordButton");

wordFile.addEventListener("change", () => {
    const file = wordFile.files[0];

    document.getElementById("wordFileInfo").textContent =
        file
            ? `${file.name} • ${formatFileSize(file.size)}`
            : "Nenhum documento selecionado.";

    showMessage("wordMessage", "");
});

wordButton.addEventListener("click", async () => {
    const file = wordFile.files[0];

    if (!file) {
        showMessage(
            "wordMessage",
            "Selecione um documento Word primeiro.",
            "error"
        );
        return;
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
        showMessage(
            "wordMessage",
            "Selecione um arquivo DOCX válido.",
            "error"
        );
        return;
    }

    setButtonLoading(
        wordButton,
        true,
        "Convertendo documento...",
        "Converter para PDF"
    );

    let temporaryContainer;

    try {
        const arrayBuffer = await file.arrayBuffer();

        const result = await mammoth.convertToHtml({
            arrayBuffer
        });

        temporaryContainer = document.createElement("div");

        temporaryContainer.style.width = "180mm";
        temporaryContainer.style.padding = "15mm";
        temporaryContainer.style.background = "#ffffff";
        temporaryContainer.style.color = "#000000";
        temporaryContainer.style.fontFamily = "Arial, sans-serif";
        temporaryContainer.style.fontSize = "12pt";
        temporaryContainer.style.lineHeight = "1.5";
        temporaryContainer.style.position = "fixed";
        temporaryContainer.style.left = "-10000px";
        temporaryContainer.style.top = "0";

        temporaryContainer.innerHTML = `
            <style>
                * {
                    box-sizing: border-box;
                }

                p {
                    margin: 0 0 12px;
                }

                h1, h2, h3, h4 {
                    margin: 18px 0 10px;
                    page-break-after: avoid;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 12px 0;
                }

                td, th {
                    border: 1px solid #777;
                    padding: 6px;
                }

                img {
                    max-width: 100%;
                    height: auto;
                }

                ul, ol {
                    margin-bottom: 12px;
                }
            </style>

            ${result.value}
        `;

        document.body.appendChild(temporaryContainer);

        const images = temporaryContainer.querySelectorAll("img");

        for (const img of images) {
            if (!img.complete) {
                await new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }
        }

        const options = {
            margin: 10,
            filename: `${safeFilename(file.name)}.pdf`,
            image: {
                type: "jpeg",
                quality: 0.95
            },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff"
            },
            jsPDF: {
                unit: "mm",
                format: "a4",
                orientation: "portrait"
            },
            pagebreak: {
                mode: ["css", "legacy"]
            }
        };

        const html2pdfFunction =
    typeof html2pdf === "function"
        ? html2pdf
        : html2pdf.default;

if (typeof html2pdfFunction !== "function") {
    throw new Error("Não foi possível carregar a biblioteca de conversão PDF.");
}

await html2pdfFunction()
    .set(options)
    .from(temporaryContainer)
    .save();

        showMessage(
            "wordMessage",
            "Documento convertido para PDF com sucesso!",
            "success"
        );

    } catch (error) {
        console.error("Erro na conversão Word:", error);

        showMessage(
            "wordMessage",
            "Não foi possível converter o documento. " + error.message,
            "error"
        );

    } finally {
        if (temporaryContainer) {
            temporaryContainer.remove();
        }

        setButtonLoading(
            wordButton,
            false,
            "",
            "Converter para PDF"
        );
    }
});


// ==========================================
// COMPRIMIR PDF
// ==========================================

const compressFile = document.getElementById("compressFile");
const compressButton = document.getElementById("compressButton");

compressFile.addEventListener("change", () => {
    const file = compressFile.files[0];

    document.getElementById("compressFileInfo").textContent =
        file
            ? `${file.name} • ${formatFileSize(file.size)}`
            : "Nenhum PDF selecionado.";

    showMessage("compressMessage", "");
});

compressButton.addEventListener("click", async () => {
    const file = compressFile.files[0];

    if (!file) {
        showMessage(
            "compressMessage",
            "Selecione um PDF primeiro.",
            "error"
        );
        return;
    }

    if (!isPdf(file)) {
        showMessage(
            "compressMessage",
            "Selecione um arquivo PDF válido.",
            "error"
        );
        return;
    }

    const level = document.getElementById("compressionLevel").value;

    const settings = {
        high: {
            scale: 1.8,
            quality: 0.82
        },
        medium: {
            scale: 1.3,
            quality: 0.65
        },
        low: {
            scale: 0.9,
            quality: 0.45
        }
    };

    const selectedSettings = settings[level];

    setButtonLoading(
        compressButton,
        true,
        "Comprimindo PDF...",
        "Comprimir PDF"
    );

    try {
        const originalBytes = await file.arrayBuffer();

        const pdf = await pdfjsLib.getDocument({
            data: new Uint8Array(originalBytes)
        }).promise;

        const outputPdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {

            setButtonLoading(
                compressButton,
                true,
                `Comprimindo página ${pageNumber} de ${pdf.numPages}...`,
                "Comprimir PDF"
            );

            const page = await pdf.getPage(pageNumber);

            const viewport = page.getViewport({
                scale: selectedSettings.scale
            });

            const canvas = document.createElement("canvas");

            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            const context = canvas.getContext("2d", {
                alpha: false
            });

            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({
                canvasContext: context,
                viewport
            }).promise;

            const imageData = canvas.toDataURL(
                "image/jpeg",
                selectedSettings.quality
            );

            const pageWidth = page.view[2] - page.view[0];
            const pageHeight = page.view[3] - page.view[1];

            if (pageNumber > 1) {
                outputPdf.addPage(
                    [pageWidth, pageHeight],
                    pageWidth > pageHeight ? "landscape" : "portrait"
                );
            } else {
                outputPdf.deletePage(1);

                outputPdf.addPage(
                    [pageWidth, pageHeight],
                    pageWidth > pageHeight ? "landscape" : "portrait"
                );
            }

            outputPdf.addImage(
                imageData,
                "JPEG",
                0,
                0,
                pageWidth,
                pageHeight,
                undefined,
                "FAST"
            );

            canvas.width = 1;
            canvas.height = 1;
        }

        const compressedBytes = outputPdf.output("arraybuffer");

        const originalSize = file.size;
        const finalSize = compressedBytes.byteLength;

        const difference = originalSize - finalSize;

        const percentage = originalSize > 0
            ? ((difference / originalSize) * 100).toFixed(1)
            : 0;

        const filename =
            `${safeFilename(file.name)}-comprimido.pdf`;

        downloadFile(
            compressedBytes,
            filename,
            "application/pdf"
        );

        if (difference > 0) {
            showMessage(
                "compressMessage",
                `PDF comprimido! Original: ${formatFileSize(originalSize)}. ` +
                `Novo tamanho: ${formatFileSize(finalSize)}. ` +
                `Redução de ${percentage}%.`,
                "success"
            );
        } else {
            showMessage(
                "compressMessage",
                `O PDF foi processado, mas não ficou menor. Original: ${formatFileSize(originalSize)}. Resultado: ${formatFileSize(finalSize)}.`,
                ""
            );
        }

        await pdf.destroy();

    } catch (error) {
        console.error("Erro ao comprimir PDF:", error);

        showMessage(
            "compressMessage",
            "Não foi possível comprimir o PDF. Verifique se ele está válido e não possui senha. " + error.message,
            "error"
        );

    } finally {
        setButtonLoading(
            compressButton,
            false,
            "",
            "Comprimir PDF"
        );
    }
});
