
import { supabase } from "./supabase.js";

const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

// Verificar se já existe uma sessão
const { data: { session } } = await supabase.auth.getSession();

if (session) {
    window.location.replace("./app.html");
}

// Realizar login
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginButton.disabled = true;
    loginButton.textContent = "Verificando...";
    loginMessage.textContent = "";
    loginMessage.className = "message";

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        loginMessage.textContent = "E-mail ou senha inválidos.";
        loginMessage.className = "message error";

        loginButton.disabled = false;
        loginButton.textContent = "Entrar no sistema";
        return;
    }

    window.location.replace("./app.html");
});
