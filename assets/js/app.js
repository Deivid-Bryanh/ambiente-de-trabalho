
import { supabase } from "./supabase.js";

// Verificar autenticação
const {
    data: { session }
} = await supabase.auth.getSession();

if (!session) {
    window.location.replace("./index.html");
}

// Mostrar usuário conectado
document.getElementById("userEmail").textContent =
    session.user.email;

// Encerrar sessão
document.getElementById("logoutButton").addEventListener(
    "click",
    async () => {
        const { error } = await supabase.auth.signOut();

        if (!error) {
            window.location.replace("./index.html");
        }
    }
);
