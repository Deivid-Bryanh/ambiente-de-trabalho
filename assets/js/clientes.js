
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
        installmentTotal.textContent = "";
        return;
    }

    // Calcula automaticamente a divisão dos honorários
    const automaticValues = calculateInstallments(total, quantity);

    installmentList.innerHTML = Array.from(
        { length: quantity },
        (_, index) => {
            const month = addMonths(firstMonth, index);

            return `
                <div class="installment-item">
                    <div>
                        <label>Parcela ${index + 1}</label>
                        <strong>${index + 1} de ${quantity}</strong>
                    </div>

                    <div>
                        <label>Mês de referência</label>
                        <input
                            type="month"
                            class="installment-month"
                            value="${month}"
                            required
                        >
                    </div>

                    <div>
                        <label>Valor (R$)</label>
                        <input
                            type="number"
                            class="installment-value"
                            min="0"
                            step="0.01"
                            value="${automaticValues[index].toFixed(2)}"
                            required
                        >
                    </div>
                </div>
            `;
        }
    ).join("");

    updateInstallmentTotal();
}
