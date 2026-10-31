
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { supabase } from "./supabase.js";

// Verifica se o usuário está autenticado.
const { data: { session }, error: sessionError } =
    await supabase.auth.getSession();

if (sessionError || !session) {
    window.location.replace("./index.html");
}

// Elementos da página.
const imageFiles = document.getElementById("imageFiles");
const mergeFiles = document.getElementById("mergeFiles");
const splitFile = document.getElementById("splitFile");
const pageRange = document.getElementById("pageRange");

function showMessage(id, message, type = "") {
    const element = document.getElementById(id);
    element.textContent = message;
    element.className = `tool-message ${type}`;
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

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "_");
}

// Converte imagens em PDF.
document.getElementById("imageToPdfButton")
    .addEventListener("click", async () => {
        const files = Array.from(imageFiles.files);

        if (files.length === 0) {
            showMessage("imageMessage", "Selecione pelo menos uma imagem.", "error");
            return;
        }

        const button = document.getElementById("imageToPdfButton");
        button.disabled = true;
        button.textContent = "Convertendo...";

        try {
            const pdf = await PDFDocument.create();

            for (const file of files) {
                if (!file.type.startsWith("image/")) {
                    throw new Error(`Arquivo não é uma imagem: ${file.name}`);
                }

                const bytes = await file.arrayBuffer();
                let image;

                if (file.type === "image/png") {
                    image = await pdf.embedPng(bytes);
                } else if (
                    file.type === "image/jpeg" ||
                    file.type === "image/jpg"
                ) {
                    image = await pdf.embedJpg(bytes);
                } else {
                    // Converte formatos como WebP para JPEG.
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
                        throw new Error(`Não foi possível converter ${file.name}`);
                    }

                    image = await pdf.embedJpg(
                        await convertedBlob.arrayBuffer()
                    );
                }

                const page = pdf.addPage([
                    image.width,
                    image.height
                ]);

                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height
                });
            }

            const result = await pdf.save();

            downloadFile(
                result,
                "imagens-convertidas.pdf",
                "application/pdf"
            );

            showMessage(
                "imageMessage",
                "PDF criado com sucesso!",
                "success"
            );

        } catch (error) {
            showMessage("imageMessage", error.message, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Converter para PDF";
        }
    });

// Mescla vários PDFs.
document.getElementById("mergeButton")
    .addEventListener("click", async () => {
        const files = Array.from(mergeFiles.files);

        if (files.length < 2) {
            showMessage("mergeMessage", "Selecione pelo menos dois PDFs.", "error");
            return;
        }

        const button = document.getElementById("mergeButton");
        button.disabled = true;
        button.textContent = "Mesclando...";

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

            downloadFile(
                result,
                "documentos-mesclados.pdf",
                "application/pdf"
            );

            showMessage(
                "mergeMessage",
                "PDFs mesclados com sucesso!",
                "success"
            );

        } catch (error) {
            showMessage(
                "mergeMessage",
                "Não foi possível mesclar os arquivos. Verifique se os PDFs não estão protegidos por senha. " + error.message,
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = "Mesclar arquivos";
        }
    });

// Interpreta intervalos como 1-3, 5, 8.
function parsePageRange(value, totalPages) {
    const pages = new Set();
    const parts = value.split(",").map(part => part.trim());

    if (!value.trim() || parts.some(part => !part)) {
        throw new Error("Informe as páginas. Exemplo: 1-3, 5, 8.");
    }

    for (const part of parts) {
        if (/^\d+$/.test(part)) {
            const page = Number(part);

            if (page < 1 || page > totalPages) {
                throw new Error(`A página ${page} não existe neste PDF.`);
            }

            pages.add(page - 1);
            continue;
        }

        const range = part.match(/^(\d+)\s*-\s*(\d+)$/);

        if (!range) {
            throw new Error(`Intervalo inválido: ${part}`);
        }

        const start = Number(range[1]);
        const end = Number(range[2]);

        if (start < 1 || end > totalPages || start > end) {
            throw new Error(`Intervalo inválido: ${part}`);
        }

        for (let page = start; page <= end; page++) {
            pages.add(page - 1);
        }
    }

    return [...pages].sort((a, b) => a - b);
}

// Extrai páginas específicas.
document.getElementById("splitButton")
    .addEventListener("click", async () => {
        const file = splitFile.files[0];
        const range = pageRange.value;

        if (!file) {
            showMessage("splitMessage", "Selecione um PDF.", "error");
            return;
        }

        if (!range.trim()) {
            showMessage("splitMessage", "Informe as páginas desejadas.", "error");
            return;
        }

        const button = document.getElementById("splitButton");
        button.disabled = true;
        button.textContent = "Dividindo...";

        try {
            const bytes = await file.arrayBuffer();
            const sourcePdf = await PDFDocument.load(bytes);
            const totalPages = sourcePdf.getPageCount();

            const selectedPages = parsePageRange(range, totalPages);

            const newPdf = await PDFDocument.create();

            const copiedPages = await newPdf.copyPages(
                sourcePdf,
                selectedPages
            );

            copiedPages.forEach(page => newPdf.addPage(page));

            const result = await newPdf.save();

            downloadFile(
                result,
                `${safeFilename(file.name)}-paginas.pdf`,
                "application/pdf"
            );

            showMessage(
                "splitMessage",
                `${selectedPages.length} página(s) extraída(s) com sucesso!`,
                "success"
            );

        } catch (error) {
            showMessage("splitMessage", error.message, "error");
        } finally {
            button.disabled = false;
            button.textContent = "Dividir PDF";
        }
    });
