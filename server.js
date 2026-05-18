const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const caminhoProdutos = path.join(__dirname, "produtos.json");
const caminhoVendas = path.join(__dirname, "vendas.json");

// =========================================================================
// NOVO: SISTEMA DE SEGURANÇA (ESCRITA ATÔMICA E BACKUPS DIÁRIOS)
// =========================================================================

// Função para salvar arquivos de forma atômica (previne corrupção se a energia cair)
function salvarArquivoSeguro(caminhoArquivo, dados) {
  const stringDados = JSON.stringify(dados, null, 2);
  const caminhoTemp = `${caminhoArquivo}.tmp`;

  try {
    // 1. Grava os dados primeiro no arquivo temporário (.tmp)
    fs.writeFileSync(caminhoTemp, stringDados, "utf8");
    // 2. Se gravou com sucesso, substitui o original (operação atômica instantânea)
    fs.renameSync(caminhoTemp, caminhoArquivo);
  } catch (erro) {
    console.error(
      `[ERRO CRÍTICO] Falha ao salvar arquivo em ${caminhoArquivo}:`,
      erro,
    );
    if (fs.existsSync(caminhoTemp)) {
      fs.unlinkSync(caminhoTemp);
    }
    throw erro;
  }
}

// Rotina preventiva: Cria backup uma vez por dia ao iniciar o servidor
const pastaBackups = path.join(__dirname, "backups");
if (!fs.existsSync(pastaBackups)) {
  fs.mkdirSync(pastaBackups);
}

function executarBackupPreventivo() {
  const dataHoje = new Date().toISOString().split("T")[0]; // AAAA-MM-DD
  const arquivos = [caminhoProdutos, caminhoVendas];

  arquivos.forEach((caminhoOriginal) => {
    if (fs.existsSync(caminhoOriginal)) {
      const nomeBase = path.basename(caminhoOriginal, ".json");
      const caminhoDestino = path.join(
        pastaBackups,
        `${nomeBase}_${dataHoje}.json`,
      );

      // Só gera a cópia diária se o backup de hoje ainda não existir
      if (!fs.existsSync(caminhoDestino)) {
        fs.copyFileSync(caminhoOriginal, caminhoDestino);
        console.log(
          `[BACKUP AUTOMÁTICO] Cópia de segurança criada para: ${nomeBase}`,
        );
      }
    }
  });
}

// Executa o backup assim que a papelaria liga o servidor
executarBackupPreventivo();

// =========================================================================
// ROTA: Buscar todos os produtos
app.get("/api/produtos", (req, res) => {
  fs.readFile(caminhoProdutos, "utf8", (err, data) => {
    if (err) return res.status(500).json({ erro: "Erro ao ler produtos" });
    res.json(JSON.parse(data));
  });
});

// ROTA COM SEGURANÇA MÁXIMA: Salva a lista de produtos validando duplicidade
app.post("/api/produtos/salvar", (req, res) => {
  const listaProdutos = req.body;

  // MELHORIA DE SEGURANÇA: Bloqueia duplicidade de código de barras a nível de servidor
  const codigos = listaProdutos.map((p) => p.codigo_barras);
  const temDuplicado = codigos.some(
    (codigo, index) => codigos.indexOf(codigo) !== index,
  );

  if (temDuplicado) {
    return res.status(400).json({
      erro: "Segurança Barrada: Tentativa de gravação de código de barras duplicado no estoque!",
    });
  }

  try {
    // MODIFICADO: Agora usa a escrita atômica segura
    salvarArquivoSeguro(caminhoProdutos, listaProdutos);
    res.json({ sucesso: true });
  } catch (err) {
    res
      .status(500)
      .json({ erro: "Erro crítico ao salvar produtos com segurança" });
  }
});

// ROTA: Buscar todo o histórico de vendas
app.get("/api/vendas", (req, res) => {
  fs.readFile(caminhoVendas, "utf8", (err, data) => {
    if (err) return res.status(500).json({ erro: "Erro ao ler vendas" });
    res.json(JSON.parse(data));
  });
});

// ROTA: Registrar uma nova venda concluída
app.post("/api/vendas", (req, res) => {
  const novaVenda = req.body;

  fs.readFile(caminhoVendas, "utf8", (err, data) => {
    let historicoVendas = [];

    if (!err && data) {
      try {
        historicoVendas = JSON.parse(data);
      } catch (e) {
        historicoVendas = [];
      }
    }

    // Insere a nova transação no histórico
    historicoVendas.push(novaVenda);

    try {
      // MODIFICADO: Substituído fs.writeFile pela escrita atômica robusta
      salvarArquivoSeguro(caminhoVendas, historicoVendas);
      res.json({ sucesso: true });
    } catch (errSalvar) {
      res
        .status(500)
        .json({ erro: "Erro crítico ao salvar histórico de vendas" });
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Papelly integrada rodando em: http://localhost:${PORT}`);
});
