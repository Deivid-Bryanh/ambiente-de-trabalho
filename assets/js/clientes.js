
import { supabase } from "./supabase.js";

const form = document.getElementById("clientForm");
const clientsList = document.getElementById("clientsList");
const formMessage = document.getElementById("formMessage");
const listMessage = document.getElementById("listMessage");
const saveButton = document.getElementById("saveButton");
const cancelButton = document.getElementById("cancelButton");
const searchInput = document.getElementById("searchInput");
const filterStatus = document.getElementById("filterStatus");

let clients = [];

const statusNames = {
  agendamento: "Agendamento",
  concluido: "Concluído",
  em_aberto: "Em aberto"
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function showMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `message-area ${type}`;
}

function formatCPF(cpf) {
  const value = String(cpf || "").replace(/\D/g, "");
  if (value.length !== 11) return value;

  return value.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    "$1.$2.$3-$4"
  );
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

async function checkSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    window.location.replace("./index.html");
    return false;
  }

  return true;
}

async function loadClients() {
  showMessage(listMessage, "Carregando clientes...");

  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    showMessage(
      listMessage,
      "Não foi possível carregar os clientes: " + error.message,
      "error"
    );
    return;
  }

  clients = data || [];
  renderClients();
}

function renderClients() {
  const search = searchInput.value
    .toLowerCase()
    .trim();

  const status = filterStatus.value;

  const filtered = clients.filter(client => {
    const name = (client.nome || "").toLowerCase();
    const cpf = (client.cpf || "").toLowerCase();

    const matchesSearch =
      name.includes(search) || cpf.includes(search);

    const matchesStatus =
      !status || client.status === status;

    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    clientsList.innerHTML = `
      <tr>
        <td colspan="5">Nenhum cliente encontrado.</td>
      </tr>
    `;
    showMessage(listMessage, `${clients.length} cliente(s) cadastrado(s).`);
    return;
  }

  clientsList.innerHTML = filtered.map(client => `
    <tr>
      <td>${escapeHTML(client.nome)}</td>
      <td>${escapeHTML(formatCPF(client.cpf))}</td>
      <td>
        <span class="status ${escapeHTML(client.status)}">
          ${escapeHTML(statusNames[client.status] || client.status)}
        </span>
      </td>
      <td>${escapeHTML(client.observacoes || "—")}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit"
            data-id="${escapeHTML(client.id)}">
            Editar
          </button>
          <button type="button" class="danger-button"
            data-action="delete"
            data-id="${escapeHTML(client.id)}">
            Excluir
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  showMessage(listMessage, `${filtered.length} cliente(s) encontrado(s).`);
}

function resetForm() {
  form.reset();
  document.getElementById("clientId").value = "";
  document.getElementById("formTitle").textContent = "Cadastrar cliente";
  saveButton.textContent = "Cadastrar cliente";
  cancelButton.hidden = true;
  document.getElementById("honorarios").value = "0";
  showMessage(formMessage, "");
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const id = document.getElementById("clientId").value;

  const cpf = document.getElementById("cpf").value
    .replace(/\D/g, "");

  if (cpf.length !== 11) {
    showMessage(formMessage, "Informe um CPF com 11 números.", "error");
    return;
  }

  const dataInicial = document.getElementById("dataInicial").value || null;
  const dataFinal = document.getElementById("dataFinal").value || null;

  if (dataInicial && dataFinal && dataFinal < dataInicial) {
    showMessage(formMessage, "A data final não pode ser anterior à data inicial.", "error");
    return;
  }

  const honorarios = Number(
    document.getElementById("honorarios").value || 0
  );

  if (!Number.isFinite(honorarios) || honorarios < 0) {
    showMessage(formMessage, "Informe um valor válido para os honorários.", "error");
    return;
  }

  const clientData = {
    nome: document.getElementById("nome").value.trim(),
    cpf,
    caso: document.getElementById("caso").value.trim(),
    descricao: document.getElementById("descricao").value.trim(),
    observacoes: document.getElementById("observacoes").value.trim(),
    status: document.getElementById("status").value,
    data_inicial: dataInicial,
    data_final: dataFinal,
    honorarios,
    forma_pagamento: document.getElementById("formaPagamento").value || null
  };

  if (!clientData.nome || !clientData.caso) {
    showMessage(formMessage, "Preencha o nome e o caso.", "error");
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";

  let result;

  if (id) {
    result = await supabase
      .from("clientes")
      .update(clientData)
      .eq("id", id);
  } else {
    result = await supabase
      .from("clientes")
      .insert(clientData);
  }

  saveButton.disabled = false;
  saveButton.textContent = id ? "Salvar alterações" : "Cadastrar cliente";

  if (result.error) {
    showMessage(
      formMessage,
      "Erro ao salvar: " + result.error.message,
      "error"
    );
    return;
  }

  showMessage(
    formMessage,
    id ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!",
    "success"
  );

  resetForm();
  await loadClients();
});

function editClient(id) {
  const client = clients.find(item => item.id === id);

  if (!client) return;

  document.getElementById("clientId").value = client.id;
  document.getElementById("nome").value = client.nome || "";
  document.getElementById("cpf").value = formatCPF(client.cpf);
  document.getElementById("caso").value = client.caso || "";
  document.getElementById("descricao").value = client.descricao || "";
  document.getElementById("observacoes").value = client.observacoes || "";
  document.getElementById("status").value = client.status || "em_aberto";
  document.getElementById("dataInicial").value = client.data_inicial || "";
  document.getElementById("dataFinal").value = client.data_final || "";
  document.getElementById("honorarios").value = client.honorarios ?? 0;
  document.getElementById("formaPagamento").value = client.forma_pagamento || "";

  document.getElementById("formTitle").textContent = "Editar cliente";
  saveButton.textContent = "Salvar alterações";
  cancelButton.hidden = false;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteClient(id) {
  const client = clients.find(item => item.id === id);

  if (!client) return;

  const confirmed = confirm(
    `Deseja realmente excluir o cadastro de ${client.nome}?`
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id);

  if (error) {
    showMessage(listMessage, "Erro ao excluir: " + error.message, "error");
    return;
  }

  showMessage(listMessage, "Cliente excluído com sucesso!", "success");
  await loadClients();
}

clientsList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === "edit") {
    editClient(id);
  }

  if (button.dataset.action === "delete") {
    deleteClient(id);
  }
});

cancelButton.addEventListener("click", resetForm);
searchInput.addEventListener("input", renderClients);
filterStatus.addEventListener("change", renderClients);

document.getElementById("cpf").addEventListener("input", event => {
  let value = event.target.value.replace(/\D/g, "").slice(0, 11);

  if (value.length > 9) {
    value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})$/, "$1.$2.$3-$4");
  } else if (value.length > 6) {
    value = value.replace(/^(\d{3})(\d{3})(\d{0,3})$/, "$1.$2.$3");
  } else if (value.length > 3) {
    value = value.replace(/^(\d{3})(\d{0,3})$/, "$1.$2");
  }

  event.target.value = value;
});

const authenticated = await checkSession();

if (authenticated) {
  await loadClients();
}
