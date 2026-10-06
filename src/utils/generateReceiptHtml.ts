// utils/generateReceiptHtml.ts

// utils/generateReceiptHtml.ts
import type { SaleData } from "../services/salesService"; // Assumindo que você definirá esta interface SaleData globalmente
 // Assumindo que você definirá esta interface SaleData globalmente

const getCurrentDateTime = () => {
    return new Date().toLocaleString("pt-BR", {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const generateReceiptHtml = (saleData: SaleData): string => {
    const date = getCurrentDateTime();
    const storeName = "Seu Ponto de Venda"; 
    const address = "Rua Principal, 123 - Cidade/UF"; 

    return `
    <html>
    <head>
        <title>Cupom de Venda Não Fiscal</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

            body {
                font-family: 'Inter', sans-serif;
                width: 58mm;
                margin: 0;
                padding: 10px 6px;
                font-size: 10px;
                color: #111;
                background: #fff;
            }

            .center { text-align: center; }
            .right { text-align: right; }
            .left { text-align: left; }

            .line {
                border-bottom: 1px dashed #444;
                margin: 8px 0;
            }

            .header-title {
                font-size: 15px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }

            .subtext {
                font-size: 9px;
                color: #444;
                margin-top: 2px;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 5px;
            }

            th {
                font-size: 10px;
                font-weight: 700;
                border-bottom: 1px solid #ccc;
                padding-bottom: 3px;
            }

            td {
                padding: 3px 0;
                vertical-align: top;
            }

            .item-name {
                max-width: 105px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .total-box {
                background: #f7fdf7;
                border: 1px solid #b6e7b6;
                padding: 5px;
                border-radius: 4px;
                font-size: 13px;
                font-weight: 700;
                margin-top: 8px;
            }

            .payment-title {
                font-size: 11px;
                font-weight: 700;
                margin-bottom: 4px;
            }

            .footer-msg {
                font-style: italic;
                margin-top: 12px;
                font-size: 9px;
                color: #666;
            }
        </style>
    </head>

    <body>
        <div class="center">
            <p class="header-title">${storeName.toUpperCase()}</p>
            <p class="subtext">${address}</p>
            <p class="subtext">Cupom Não Fiscal — Confiança e Agilidade</p>
        </div>

        <div class="line"></div>

        <p>
            <strong>Data:</strong> ${date}<br>
            <strong>Cliente:</strong> ${saleData.clientName}
        </p>

        <div class="line"></div>

        <table>
            <thead>
                <tr>
                    <th class="left">Item</th>
                    <th class="right">Qtd</th>
                    <th class="right">Un</th>
                    <th class="right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${saleData.items
                    .map(
                        (item) => `
                    <tr>
                        <td class="item-name">${item.name}</td>
                        <td class="right">${item.saleQty}</td>
                        <td class="right">R$ ${item.price.toFixed(2)}</td>
                        <td class="right">R$ ${(item.saleQty * item.price).toFixed(2)}</td>
                    </tr>
                `
                    )
                    .join("")}
            </tbody>
        </table>

        <div class="line"></div>

        <div>
            <div class="flex">
                <span>Subtotal:</span>
                <span class="right">R$ ${saleData.subtotal.toFixed(2)}</span>
            </div>

            ${
                saleData.discount > 0
                    ? `
                <div class="flex" style="color:#c62828;">
                    <span>Desconto:</span>
                    <span>- R$ ${saleData.discount.toFixed(2)}</span>
                </div>
            `
                    : ""
            }
        </div>

        <div class="total-box center">
            TOTAL PAGO: R$ ${saleData.total.toFixed(2)}
        </div>

        <div class="line"></div>

        <p class="payment-title">FORMA(S) DE PAGAMENTO</p>
        ${saleData.distributedPayments
            .map(
                (p) => `
            <div class="flex" style="display:flex; justify-content:space-between;">
                <span>${p.method.toUpperCase()}</span>
                <span>R$ ${p.value.toFixed(2)}</span>
            </div>
        `
            )
            .join("")}

        <div class="line"></div>

        <div class="center footer-msg">
            Obrigado pela preferência! Volte sempre. ❤️
        </div>

    </body>
    </html>
    `;
};
