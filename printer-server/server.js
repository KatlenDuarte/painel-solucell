const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { print } = require("pdf-to-printer");
const puppeteer = require("puppeteer");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PRINTER_NAME = "ELGIN i9(USB)";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function gerarHtmlCupom(sale) {
  const isOS = sale.isOS === true;

  // LÓGICA 1: RENDERIZAÇÃO EXCLUSIVA PARA ORDEM DE SERVIÇO (MANUTENÇÃO)
  if (isOS) {
    // Separa os itens normais (peças/mão de obra) de linhas informativas (como o Defeito relatado)
    const linhasServico = (sale.items || [])
      .map((item) => {
        const preco = Number(item.price || 0);
        return `
          <tr>
            <td style="text-align: left; font-weight: bold; padding: 5px 0;">${item.name}</td>
            <td style="text-align: right; font-weight: bold; padding: 5px 0;">${preco > 0 ? formatMoney(preco) : "---"}</td>
          </tr>
        `;
      })
      .join("");

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  html, body { margin: 0; padding: 0; background-color: #ffffff; -webkit-print-color-adjust: exact; }
  body {
    font-family: 'Courier New', Courier, monospace;
    width: 265px;
    font-size: 11px;
    line-height: 1.4;
    color: #000000;
    padding: 4px 6px;
    box-sizing: border-box;
  }
  .header { text-align: center; margin-bottom: 8px; }
  .header h1 { font-size: 17px; font-weight: bold; margin: 0 0 2px 0; text-transform: uppercase; }
  .header p { margin: 2px 0; font-size: 10px; }
  
  .badge-os {
    font-weight: bold;
    font-size: 14px;
    border: 2px solid #000;
    padding: 4px;
    display: block;
    text-align: center;
    margin: 6px 0;
    letter-spacing: 1px;
    background-color: #000;
    color: #fff;
  }
  
  .divisor { border: 0; border-top: 1px dashed #000000; margin: 6px 0; height: 0; }
  .secao-titulo { font-weight: bold; text-transform: uppercase; font-size: 11px; margin-bottom: 3px; display: block; }
  .bloco-dados { margin: 5px 0; font-size: 11px; }
  
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  th { font-size: 10px; text-transform: uppercase; padding-bottom: 3px; border-bottom: 1px solid #000; }
  
  .box-alerta-garantia {
    border: 2px solid #000;
    padding: 6px;
    margin: 8px 0;
    background: #ffffff;
  }
  .box-alerta-garantia h2 { font-size: 11px; margin: 0 0 4px 0; font-weight: bold; text-align: center; text-transform: uppercase; }
  .box-alerta-garantia p { margin: 3px 0; font-size: 10px; text-align: left; line-height: 1.3; }

  .linha-total-os {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    font-weight: bold;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    padding: 5px 0;
    margin: 8px 0;
  }
  .assinatura { text-align: center; margin-top: 25px; }
  .sistema { font-size: 8px; color: #444; text-align: center; margin-top: 15px; text-transform: uppercase; }
  
  tr, p, div, .box-alerta-garantia { page-break-inside: avoid; }
</style>
</head>
<body>

  <div class="header">
    <h1>SOLUCELL</h1>
    <p>SOLUCELL GÁVEA</p>
    <p>Telefone: (31) 98551-2625</p>
    <div class="badge-os">ORDEM DE SERVIÇO</div>
    <p>Data/Hora: ${new Date().toLocaleString("pt-BR")}</p>
  </div>

  <div class="divisor"></div>

  <div class="bloco-dados">
    <span class="secao-titulo">[ Dados do Cliente ]</span>
    <strong>NOME:</strong> ${sale.customer || "Não informado"}<br>
    <strong>TEL:</strong> ${sale.phone || "Não informado"}
  </div>

  <div class="divisor"></div>

  <div class="bloco-dados">
    <span class="secao-titulo">[ Detalhes da Manutenção ]</span>
    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Descrição do Serviço / Ativo</th>
          <th style="text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${linhasServico}
      </tbody>
    </table>
  </div>

  <div class="linha-total-os">
    <span>VALOR TOTAL:</span>
    <span>${formatMoney(sale.total)}</span>
  </div>

  <div class="bloco-dados" style="margin-bottom: 8px;">
    <strong>STATUS FINANCEIRO:</strong> <span style="text-transform: uppercase;">${sale.paymentMethod || "A VERIFICAR"}</span>
  </div>

  <div class="box-alerta-garantia">
    <h2>⚠️ TERMOS DE GARANTIA E REGRAS</h2>
    <p>• <strong>PRAZO DE GARANTIA:</strong> Cobertura legal de <strong>3 MESES (90 dias)</strong> corrido a partir da data de retirada, válida estritamente sobre a peça trocada.</p>
    <p>• <strong>PELÍCULA DE GARANTIA / SELO:</strong> A remoção da película protetora ou do selo interno aplicado pelo técnico implicará na <strong>PERDA IMEDIATA E IRREVOGÁVEL DA GARANTIA</strong>. NÃO REMOVA!</p>
    <p>• <strong>EXCLUSÕES:</strong> A garantia perderá o efeito caso o dispositivo apresente novos danos por quedas, marcas de pressão na tela, trincados ou sinais de oxidação por contato com líquidos.</p>
    <p>• <strong>RETIRADA:</strong> Aparelhos prontos não retirados em até 90 dias estarão sujeitos a descarte ou venda para custeio de peças conforme legislação vigente.</p>
  </div>

  <div class="assinatura">
    <p style="margin-bottom: 25px; font-size: 10px; text-align: left;">De acordo com os termos acima descritos:</p>
    <p>____________________________________</p>
    <p style="font-size: 9px; margin-top: 2px;">Assinatura do Cliente</p>
  </div>

  <p class="sistema">PDV Solucell v1.0.0 • OS</p>

</body>
</html>
`;
  }

  // LÓGICA 2: RENDERIZAÇÃO PADRÃO PARA CUPOM DE VENDA COMUM
  const itensVenda = (sale.items || [])
    .map((item) => {
      const qtd = item.saleQty || 1;
      const precoUnitario = Number(item.price || 0);
      const totalItem = precoUnitario * qtd;

      return `
        <tr>
          <td style="width: 12%; text-align: left;">${String(qtd).padStart(2, '0')}</td>
          <td style="width: 50%; text-align: left; font-weight: bold;">${item.name}</td>
          <td style="width: 18%; text-align: right;">${formatMoney(precoUnitario).replace("R$", "")}</td>
          <td style="width: 20%; text-align: right; font-weight: bold;">${formatMoney(totalItem).replace("R$", "")}</td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  html, body { margin: 0; padding: 0; background-color: #ffffff; -webkit-print-color-adjust: exact; }
  body {
    font-family: 'Courier New', Courier, monospace;
    width: 265px;
    font-size: 11px;
    line-height: 1.3;
    color: #000000;
    padding: 6px 10px;
    box-sizing: border-box;
  }
  .header { text-align: center; margin-bottom: 10px; }
  .header h1 { font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0 0 2px 0; letter-spacing: 1px; }
  .header p { margin: 2px 0; font-size: 10px; }
  .sub-titulo { font-weight: bold; border: 1px solid #000; padding: 2px; display: inline-block; margin: 4px 0 !important; letter-spacing: 1px; }
  .divisor { border: 0; border-top: 1px dashed #000000; margin: 6px 0; height: 0; }
  table { width: 100%; border-collapse: collapse; margin: 5px 0; }
  th { font-size: 10px; text-transform: uppercase; padding-bottom: 4px; border-bottom: 1px solid #000; }
  td { padding: 4px 0; vertical-align: top; word-break: break-word; }
  .totais-container { margin-top: 6px; }
  .linha-info { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
  .linha-total { display: flex; justify-content: space-between; margin: 6px 0; font-size: 15px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; }
  .footer { text-align: center; margin-top: 12px; font-size: 10px; }
  .footer p { margin: 3px 0; }
  .sistema { font-size: 8px; color: #444; margin-top: 8px !important; text-transform: uppercase; }
  tr, p, .linha-info, .linha-total { page-break-inside: avoid; }
</style>
</head>
<body>

  <div class="header">
    <h1>SOLUCELL</h1>
    <p>SOLUCELL GÁVEA</p>
    <p>Telefone: (31) 98551-2625</p>
    <p class="sub-titulo">@solucellgavea2</p>
    <p style="margin-top: 5px;">Data: ${new Date().toLocaleString("pt-BR")}</p>
  </div>

  <div class="divisor"></div>

  <table>
    <thead>
      <tr>
        <th style="width: 12%; text-align: left;">Qtd</th>
        <th style="width: 50%; text-align: left;">Item</th>
        <th style="width: 18%; text-align: right;">Unit</th>
        <th style="width: 20%; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itensVenda}
    </tbody>
  </table>

  <div class="divisor"></div>

  <div class="totais-container">
    <div class="linha-info">
      <span>Subtotal dos Itens:</span>
      <span>${formatMoney(sale.total)}</span>
    </div>
    <div class="linha-info">
      <span>Desconto:</span>
      <span>- ${formatMoney(sale.discount || 0)}</span>
    </div>
    
    <div class="linha-total">
      <span>TOTAL A PAGAR:</span>
      <span>${formatMoney(sale.total)}</span>
    </div>

    <div class="linha-info" style="margin-top: 8px;">
      <span style="font-weight: bold;">Forma de Pagamento:</span>
      <span style="text-transform: uppercase;">${sale.paymentMethod || "Não informado"}</span>
    </div>
  </div>

  <div class="divisor"></div>

  <div class="footer">
    <p style="font-weight: bold;">Obrigado pela preferência!</p>
    <p>Volte Sempre.</p>
    <p class="sistema">PDV Solucell v1.0.0</p>
  </div>

</body>
</html>
`;
}

app.post("/print", async (req, res) => {
  let browser;
  try {
    console.log("================================");
    console.log("SOLICITAÇÃO DE IMPRESSÃO");

    const sale = req.body;
    const html = gerarHtmlCupom(sale);
    const pdfPath = path.join(os.tmpdir(), `cupom_${Date.now()}.pdf`);

browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu"
  ]
});

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("screen");

    const height = await page.evaluate(() => {
      const body = document.body;
      const htmlElement = document.documentElement;
      return Math.max(body.scrollHeight, body.offsetHeight, htmlElement.clientHeight, htmlElement.scrollHeight, htmlElement.offsetHeight);
    });

    await page.pdf({
      path: pdfPath,
      width: "80mm",
      height: `${height + 20}px`,
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" }
    });

    await browser.close();
    browser = null;

    await print(pdfPath, {
      printer: PRINTER_NAME,
      silent: true
    });

    console.log("ENVIADO PARA IMPRESSORA COM SUCESSO");

    setTimeout(() => {
      try { fs.unlinkSync(pdfPath); } catch (e) { }
    }, 5000);

    res.json({ success: true, message: "Impresso com sucesso" });

  } catch (error) {
    if (browser) await browser.close();
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3333, () => {
  console.log("Servidor de impressão rodando em http://localhost:3333");
});