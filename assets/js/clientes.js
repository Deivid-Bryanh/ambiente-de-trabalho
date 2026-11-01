import { supabase } from "./supabase.js";

const clientForm = document.getElementById("clientForm");
const clientsList = document.getElementById("clientsList");
const formMessage = document.getElementById("formMessage");
const listMessage = document.getElementById("listMessage");

const saveButton = document.getElementById("saveButton");
const cancelButton = document.getElementById("cancelButton");

const searchInput = document.getElementById("searchInput");
const filterStatus = document.getElementById("filterStatus");

const installmentsSection =
    document.getElementById("installmentsSection");
const installmentList =
    document.getElementById("installmentList");
const installmentTotal =
    document.getElementById("installmentTotal");

const statusNames = {
    em_aberto: "Em aberto",
    agendamento: "Agendamento",
    concluido: "Concluído"
};

let clients = [];
let currentInstallments = [];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? "#dc2626" : "#15803d";
}

function formatCPF(value) {
    const cpf = String(value ?? "").replace(/\D/g, "");

    return cpf
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

function formatMonth(value) {
    if (!value) return "Não informado";

    const [year, month] = String(value).substring(0, 7).split("-");

    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric"
        });
}

function monthToDate(value) {
    return `${value}-01`;
}

function addMonths(monthValue, amount) {
    const [year, month] = monthValue.split("-").map(Number);
    const date = new Date(year, month - 1 + amount, 1);

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}`;
}

async function checkSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
        window.location.href = "index.html";
        return false;
    }

    return true;
}

async function loadClients() {
    listMessage.textContent = "Carregando clientes...";

    const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("criado_em", { ascending: false });

    if (error) {
        showMessage(
            listMessage,
            "Erro ao carregar clientes: " + error.message,
            true
        );
        return;
    }

    clients = data || [];
    await renderClients();
}

async function getInstallments(clientId) {
    const { data, error } = await supabase
        .from("parcelas")
        .select("*")
        .eq("cliente_id", clientId)
        .order("numero_parcela", { ascending: true });

    if (error) {
        throw error;
    }

    return data || [];
}

async function renderClients() {
    const search = searchInput.value.trim().toLowerCase();
    const statusFilter = filterStatus.value;

    const filtered = clients.filter(client => {
        const searchable = [
            client.nome,
            client.cpf,
            client.numero_processo,
            client.comarca
        ].join(" ").toLowerCase();

        const matchesSearch = searchable.includes(search);
        const matchesStatus =
            !statusFilter || client.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    if (!filtered.length) {
        clientsList.innerHTML = `
            <tr>
                <td colspan="7">Nenhum cliente encontrado.</td>
            </tr>
        `;
        listMessage.textContent = "";
        return;
    }

    clientsList.innerHTML = filtered.map(client => `
        <tr>
            <td>${escapeHTML(client.nome)}</td>
            <td>${escapeHTML(formatCPF(client.cpf))}</td>
            <td>${escapeHTML(client.numero_processo || "—")}</td>
            <td>${escapeHTML(client.comarca || "—")}</td>
            <td>
                <span class="status ${escapeHTML(client.status)}">
                    ${escapeHTML(statusNames[client.status] || client.status)}
                </span>
            </td>
            <td>${escapeHTML(client.observacoes || "—")}</td>
            <td>
                <div class="row-actions">
                    <button class="edit-button"
                            data-action="edit"
                            data-id="${client.id}">
                        Editar
                    </button>

                    <button class="delete-button"
                            data-action="delete"
                            data-id="${client.id}">
                        Excluir
                    </button>

                    <button class="installment-action"
                            data-action="details"
                            data-id="${client.id}">
                        Parcelas
                    </button>
                </div>
            </td>
        </tr>

        <tr class="client-details-row" id="details-${client.id}"
            style="display:none;">
            <td colspan="7">
                <div class="installment-record"
                     id="installment-record-${client.id}">
                    Carregando informações...
                </div>
            </td>
        </tr>
    `).join("");

    listMessage.textContent = `${filtered.length} cliente(s) encontrado(s).`;
}

function getDefaultMonth() {
    const now = new Date();

    return `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}`;
}

function resetForm() {
    clientForm.reset();

    document.getElementById("clientId").value = "";
    document.getElementById("formTitle").textContent =
        "Cadastrar cliente";

    saveButton.textContent = "Salvar cliente";
    cancelButton.style.display = "none";

    installmentsSection.style.display = "none";
    installmentList.innerHTML = "";
    installmentTotal.textContent = "";

    currentInstallments = [];

    document.getElementById("quantidadeParcelas").value = 2;
    document.getElementById("primeiroVencimento").value =
        getDefaultMonth();

    formMessage.textContent = "";
}

function calculateInstallments(total, quantity) {
    const totalCents = Math.round(Number(total || 0) * 100);

    if (!quantity || quantity < 1 || quantity > 120) {
        return [];
    }

    const base = Math.floor(totalCents / quantity);
    const remainder = totalCents % quantity;

    return Array.from({ length: quantity }, (_, index) => {
        const cents = base + (index < remainder ? 1 : 0);
        return cents / 100;
    });
}

function renderInstallmentInputs() {
    const total = Number(
        document.getElementById("honorarios").value || 0
    );

    const quantity = Number(
        document.getElementById("quantidadeParcelas").value || 0
    );

    const firstMonth =
        document.getElementById("primeiroVencimento").value;

    if (!quantity || quantity < 1 || quantity > 120) {
        installmentList.innerHTML =
            "<p>Informe uma quantidade entre 1 e 120 parcelas.</p>";
        installmentTotal.textContent = "";
        return;
    }

    if (!firstMonth) {
        installmentList.innerHTML =
            "<p>Informe o mês da primeira parcela.</p>";
        return;
    }

    const automaticValues = calculateInstallments(total, quantity);

    const existingValues = Array.from(
        installmentList.querySelectorAll(".installment-value")
    ).map(input => input.value);

    installmentList.innerHTML = Array.from(
        { length: quantity },
        (_, index) => {
            const month = addMonths(firstMonth, index);
            const value = existingValues[index] !== undefined
                ? existingValues[index]
                : automaticValues[index].toFixed(2);

            return `
                <div class="installment-item">
                    <div>
                        <label>Parcela ${index + 1}</label>
                        <strong>${index + 1} de ${quantity}</strong>
                    </div>

                    <div>
                        <label>Mês de referência</label>
                        <input type="month"
                               class="installment-month"
                               value="${month}"
                               required>
                    </div>

                    <div>
                        <label>Valor (R$)</label>
                        <input type="number"
                               class="installment-value"
                               min="0"
                               step="0.01"
                               value="${escapeHTML(value)}"
                               required>
                    </div>
                </div>
            `;
        }
    ).join("");

    updateInstallmentTotal();
}

function updateInstallmentTotal() {
    const values = Array.from(
        installmentList.querySelectorAll(".installment-value")
    );

    const sum = values.reduce(
        (total, input) => total + Number(input.value || 0),
        0
    );

    const honorarios = Number(
        document.getElementById("honorarios").value || 0
    );

    const difference = honorarios - sum;

    installmentTotal.textContent =
        `Total das parcelas: ${formatMoney(sum)} | ` +
        `Honorários: ${formatMoney(honorarios)} | ` +
        `Diferença: ${formatMoney(difference)}`;

    installmentTotal.style.color =
        Math.abs(difference) < 0.005 ? "#15803d" : "#dc2626";
}

function collectInstallments() {
    return Array.from(
        installmentList.querySelectorAll(".installment-item")
    ).map((item, index) => {
        const month = item.querySelector(".installment-month").value;
        const value = Number(
            item.querySelector(".installment-value").value
        );

        return {
            numero_parcela: index + 1,
            valor: value,
            mes_referencia: monthToDate(month)
        };
    });
}

async function saveInstallments(clientId, newInstallments) {
    const existing = await getInstallments(clientId);

    const existingByNumber = new Map(
        existing.map(item => [item.numero_parcela, item])
    );

    for (const installment of newInstallments) {
        const old = existingByNumber.get(
            installment.numero_parcela
        );

        if (old) {
            const { error } = await supabase
                .from("parcelas")
                .update({
                    valor: installment.valor,
                    mes_referencia: installment.mes_referencia
                })
                .eq("id", old.id);

            if (error) throw error;

            existingByNumber.delete(installment.numero_parcela);
        } else {
            const { error } = await supabase
                .from("parcelas")
                .insert({
                    cliente_id: clientId,
                    numero_parcela: installment.numero_parcela,
                    valor: installment.valor,
                    mes_referencia: installment.mes_referencia
                });

            if (error) throw error;
        }
    }

    const removedIds = Array.from(existingByNumber.values())
        .map(item => item.id);

    if (removedIds.length) {
        const { error } = await supabase
            .from("parcelas")
            .delete()
            .in("id", removedIds);

        if (error) throw error;
    }
}

async function editClient(id) {
    const client = clients.find(item => item.id === id);

    if (!client) return;

    document.getElementById("clientId").value = client.id;
    document.getElementById("nome").value = client.nome || "";
    document.getElementById("cpf").value = formatCPF(client.cpf);
    document.getElementById("numeroProcesso").value =
        client.numero_processo || "";
    document.getElementById("comarca").value = client.comarca || "";
    document.getElementById("caso").value = client.caso || "";
    document.getElementById("status").value =
        client.status || "em_aberto";
    document.getElementById("descricao").value =
        client.descricao || "";
    document.getElementById("observacoes").value =
        client.observacoes || "";
    document.getElementById("honorarios").value =
        client.honorarios ?? "";
    document.getElementById("formaPagamento").value =
        client.forma_pagamento || "";

    document.getElementById("formTitle").textContent =
        "Editar cliente";

    saveButton.textContent = "Atualizar cliente";
    cancelButton.style.display = "inline-block";

    if (client.forma_pagamento === "parcelado") {
        installmentsSection.style.display = "block";

        try {
            currentInstallments = await getInstallments(client.id);

            document.getElementById("quantidadeParcelas").value =
                currentInstallments.length || 2;

            if (currentInstallments.length) {
                const first = currentInstallments[0]
                    .mes_referencia.substring(0, 7);

                document.getElementById("primeiroVencimento").value =
                    first;

                installmentList.innerHTML =
                    currentInstallments.map(item => `
                        <div class="installment-item">
                            <div>
                                <label>Parcela ${item.numero_parcela}</label>
                                <strong>${item.numero_parcela} de ${currentInstallments.length}</strong>
                            </div>

                            <div>
                                <label>Mês de referência</label>
                                <input type="month"
                                       class="installment-month"
                                       value="${item.mes_referencia.substring(0, 7)}"
                                       required>
                            </div>

                            <div>
                                <label>Valor (R$)</label>
                                <input type="number"
                                       class="installment-value"
                                       min="0"
                                       step="0.01"
                                       value="${Number(item.valor).toFixed(2)}"
                                       required>
                            </div>
                        </div>
                    `).join("");

                updateInstallmentTotal();
            } else {
                document.getElementById("primeiroVencimento").value =
                    getDefaultMonth();

                renderInstallmentInputs();
            }
        } catch (error) {
            showMessage(
                formMessage,
                "Não foi possível carregar as parcelas: " + error.message,
                true
            );
        }
    } else {
        installmentsSection.style.display = "none";
        installmentList.innerHTML = "";
        currentInstallments = [];
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteClient(id) {
    const confirmed = confirm(
        "Tem certeza que deseja excluir este cliente? As parcelas também serão excluídas."
    );

    if (!confirmed) return;

    const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", id);

    if (error) {
        showMessage(
            listMessage,
            "Erro ao excluir cliente: " + error.message,
            true
        );
        return;
    }

    showMessage(listMessage, "Cliente excluído com sucesso.");
    await loadClients();
}

async function showClientInstallments(clientId) {
    const detailsRow = document.getElementById(`details-${clientId}`);
    const container = document.getElementById(
        `installment-record-${clientId}`
    );

    if (detailsRow.style.display !== "none") {
        detailsRow.style.display = "none";
        return;
    }

    detailsRow.style.display = "table-row";
    container.textContent = "Carregando parcelas...";

    try {
        const installments = await getInstallments(clientId);

        if (!installments.length) {
            container.innerHTML =
                "<p>Este cliente ainda não possui parcelas cadastradas.</p>";
            return;
        }

        const total = installments.reduce(
            (sum, item) => sum + Number(item.valor || 0),
            0
        );

        container.innerHTML = `
            <h3>Parcelas dos honorários</h3>
            <p><strong>Total:</strong> ${formatMoney(total)}</p>

            <table>
                <thead>
                    <tr>
                        <th>Parcela</th>
                        <th>Mês</th>
                        <th>Valor</th>
                        <th>Situação</th>
                        <th>Ação</th>
                    </tr>
                </thead>

                <tbody>
                    ${installments.map(item => `
                        <tr>
                            <td>${item.numero_parcela}</td>
                            <td>${escapeHTML(formatMonth(item.mes_referencia))}</td>
                            <td>${formatMoney(item.valor)}</td>
                            <td class="${item.pago ? "paid" : "pending"}">
                                ${item.pago ? "Paga" : "Pendente"}
                            </td>
                            <td>
                                <button class="installment-action"
                                        data-action="toggle-payment"
                                        data-id="${item.id}"
                                        data-paid="${item.pago}">
                                    ${item.pago ? "Marcar pendente" : "Marcar paga"}
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.textContent =
            "Erro ao carregar parcelas: " + error.message;
    }
}

async function togglePayment(id, currentlyPaid, clientId) {
    const newPaidStatus = !currentlyPaid;

    const { error } = await supabase
        .from("parcelas")
        .update({
            pago: newPaidStatus,
            pago_em: newPaidStatus ? new Date().toISOString() : null
        })
        .eq("id", id);

    if (error) {
        alert("Não foi possível atualizar a parcela: " + error.message);
        return;
    }

    await showClientInstallments(clientId);
    await showClientInstallments(clientId);
}

clientForm.addEventListener("submit", async event => {
    event.preventDefault();

    formMessage.textContent = "";

    const id = document.getElementById("clientId").value;
    const cpf = document.getElementById("cpf").value.replace(/\D/g, "");

    if (cpf.length !== 11) {
        showMessage(formMessage, "Informe um CPF válido com 11 números.", true);
        return;
    }

    const honorarios = Number(
        document.getElementById("honorarios").value || 0
    );

    if (honorarios < 0 || !Number.isFinite(honorarios)) {
        showMessage(formMessage, "Informe um valor válido de honorários.", true);
        return;
    }

    const formaPagamento =
        document.getElementById("formaPagamento").value;

    let installments = [];

    if (formaPagamento === "parcelado") {
        const quantity = Number(
            document.getElementById("quantidadeParcelas").value
        );

        if (!quantity || quantity < 1 || quantity > 120) {
            showMessage(
                formMessage,
                "A quantidade de parcelas deve estar entre 1 e 120.",
                true
            );
            return;
        }

        installments = collectInstallments();

        if (installments.some(item =>
            !item.mes_referencia ||
            !Number.isFinite(item.valor) ||
            item.valor < 0
        )) {
            showMessage(
                formMessage,
                "Verifique os meses e valores das parcelas.",
                true
            );
            return;
        }

        const installmentSum = installments.reduce(
            (sum, item) => sum + Math.round(item.valor * 100),
            0
        );

        const totalCents = Math.round(honorarios * 100);

        if (installmentSum !== totalCents) {
            showMessage(
                formMessage,
                "A soma das parcelas precisa ser igual ao total dos honorários.",
                true
            );
            return;
        }
    }

    const clientData = {
        nome: document.getElementById("nome").value.trim(),
        cpf,
        numero_processo:
            document.getElementById("numeroProcesso").value.trim() || null,
        comarca:
            document.getElementById("comarca").value.trim() || null,
        caso: document.getElementById("caso").value.trim(),
        descricao:
            document.getElementById("descricao").value.trim() || null,
        observacoes:
            document.getElementById("observacoes").value.trim() || null,
        status: document.getElementById("status").value,
        honorarios,
        forma_pagamento: formaPagamento || null
    };

    saveButton.disabled = true;
    saveButton.textContent = "Salvando...";

    try {
        let clientId = id;

        if (id) {
            const { error } = await supabase
                .from("clientes")
                .update(clientData)
                .eq("id", id);

            if (error) throw error;
        } else {
            const { data, error } = await supabase
                .from("clientes")
                .insert(clientData)
                .select("id")
                .single();

            if (error) throw error;

            clientId = data.id;
        }

        if (formaPagamento === "parcelado") {
            await saveInstallments(clientId, installments);
        } else if (id) {
            const { error } = await supabase
                .from("parcelas")
                .delete()
                .eq("cliente_id", clientId);

            if (error) throw error;
        }

        showMessage(
            formMessage,
            id ? "Cliente atualizado com sucesso!" :
                "Cliente cadastrado com sucesso!"
        );

        resetForm();
        await loadClients();

    } catch (error) {
        showMessage(
            formMessage,
            "Erro ao salvar: " + error.message,
            true
        );
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = id ? "Atualizar cliente" : "Salvar cliente";
    }
});

clientsList.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "edit") {
        await editClient(id);
    }

    if (action === "delete") {
        await deleteClient(id);
    }

    if (action === "details") {
        await showClientInstallments(id);
    }

    if (action === "toggle-payment") {
        const currentlyPaid = button.dataset.paid === "true";

        const row = button.closest(".client-details-row");
        const clientId = row.id.replace("details-", "");

        await togglePayment(button.dataset.id, currentlyPaid, clientId);
    }
});

document.getElementById("formaPagamento")
    .addEventListener("change", event => {
        const isInstallment = event.target.value === "parcelado";

        installmentsSection.style.display =
            isInstallment ? "block" : "none";

        if (isInstallment) {
            if (!document.getElementById("primeiroVencimento").value) {
                document.getElementById("primeiroVencimento").value =
                    getDefaultMonth();
            }

            renderInstallmentInputs();
        }
    });

document.getElementById("quantidadeParcelas")
    .addEventListener("input", renderInstallmentInputs);

document.getElementById("honorarios")
    .addEventListener("input", () => {
        if (document.getElementById("formaPagamento").value === "parcelado") {
            renderInstallmentInputs();
        }
    });

document.getElementById("primeiroVencimento")
    .addEventListener("change", renderInstallmentInputs);

installmentList.addEventListener("input", event => {
    if (event.target.classList.contains("installment-value")) {
        updateInstallmentTotal();
    }
});

cancelButton.addEventListener("click", resetForm);

searchInput.addEventListener("input", renderClients);
filterStatus.addEventListener("change", renderClients);

document.getElementById("cpf").addEventListener("input", event => {
    event.target.value = formatCPF(event.target.value);
});

document.getElementById("primeiroVencimento").value =
    getDefaultMonth();

if (await checkSession()) {
    await loadClients();
}
