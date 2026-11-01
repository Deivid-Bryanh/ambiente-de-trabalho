import { supabase } from "./supabase.js";

// Verificar autenticação
async function checkAuthentication() {
    const {
        data: { session },
        error
    } = await supabase.auth.getSession();

    if (error || !session) {
        window.location.replace("./index.html");
        return false;
    }

    // Mostrar usuário conectado
    const userEmail = document.getElementById("userEmail");

    if (userEmail) {
        userEmail.textContent = session.user.email || "Usuário conectado";
    }

    return true;
}

// Encerrar sessão
const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;

        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Erro ao encerrar sessão:", error);
            logoutButton.disabled = false;
            alert("Não foi possível encerrar a sessão. Tente novamente.");
            return;
        }

        window.location.replace("./index.html");
    });
}

// Inicializar autenticação
await checkAuthentication();
