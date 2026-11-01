import { supabase } from "./supabase.js";

const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

// Verificar se já existe uma sessão
async function checkSession() {
    try {
        const {
            data: { session },
            error
        } = await supabase.auth.getSession();

        if (error) {
            console.error("Erro ao verificar sessão:", error);
            return;
        }

        if (session) {
            window.location.replace("./app.html");
        }
    } catch (error) {
        console.error("Erro inesperado:", error);
    }
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

    try {
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

    } catch (error) {
        console.error("Erro durante o login:", error);

        loginMessage.textContent =
            "Não foi possível realizar o login. Tente novamente.";

        loginMessage.className = "message error";

        loginButton.disabled = false;
        loginButton.textContent = "Entrar no sistema";
    }
});

// Inicializar
await checkSession();
