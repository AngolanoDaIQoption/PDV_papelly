// ========================================================
// 1. ESTADO DA APLICAÇÃO (Agora alimentado pelo Backend)
// ========================================================
let produtosMock = []; // Começa vazio e carrega do arquivo .json
let carrinho = [];

// ========================================================
// 2. ELEMENTOS DA DOM
// ========================================================
const inputBusca = document.getElementById("busca-produto");
const dropdownCustom = document.getElementById("dropdown-custom");
const tabelaCarrinho = document
  .getElementById("tabela-carrinho")
  .querySelector("tbody");
const txtTotal = document.getElementById("total-venda");
const selectPagamento = document.getElementById("forma-pagamento");
const secaoTroco = document.getElementById("secao-troco");
const inputRecebido = document.getElementById("valor-recebido");
const txtTroco = document.getElementById("valor-troco");
const btnFinalizar = document.getElementById("btn-finalizar");

const botoesAbas = document.querySelectorAll(".tab-btn");
const abaCaixa = document.getElementById("aba-caixa");
const abaCadastro = document.getElementById("aba-cadastro");
const abaRelatorio = document.getElementById("aba-relatorio");

const formCadastro = document.getElementById("form-cadastro-produto");
const botoesSubAbas = document.querySelectorAll(".sub-tab-btn");
const subAbaFormulario = document.getElementById("sub-aba-formulario");
const subAbaEstoque = document.getElementById("sub-aba-estoque");
const tabelaEstoque = document
  .getElementById("tabela-estoque")
  .querySelector("tbody");

// FUNÇÃO INICIAL: Carrega os produtos direto do Servidor assim que abre a página
async function carregarProdutosDoServidor() {
  try {
    const res = await fetch("/api/produtos");
    produtosMock = await res.json();
  } catch (error) {
    console.error(
      "Erro ao conectar com o servidor para buscar produtos",
      error,
    );
  }
}

// ========================================================
// 3. FRENTE DE CAIXA (Lógica do Carrinho)
// ========================================================
inputBusca.addEventListener("keypress", async function (e) {
  if (e.key === "Enter") {
    const termoBusca = inputBusca.value.trim().toLowerCase();

    // CORREÇÃO: Fecha o dropdown flutuante se o operador der Enter com o campo vazio
    if (termoBusca === "") {
      fecharDropdown();
      return;
    }

    // Busca o produto pelo código exato ou por trecho do nome
    const produtoEncontrado = produtosMock.find(
      (p) =>
        p.codigo_barras === termoBusca ||
        p.nome.toLowerCase().includes(termoBusca),
    );

    if (produtoEncontrado) {
      adicionarAoCarrinho(produtoEncontrado);
    } else {
      // Alerta nativo substituído pelo Modal Customizado
      await chamarModal({
        titulo: "⚠️ Não Encontrado",
        mensagem: `O produto "${inputBusca.value}" não está cadastrado no sistema!`,
      });
    }

    inputBusca.value = "";
    fecharDropdown();
  }
});

function adicionarAoCarrinho(produto) {
  // CORREÇÃO DE TIPAGEM: Garante a comparação segura convertendo ambos os IDs para Number
  const itemExistente = carrinho.find(
    (i) => Number(i.id) === Number(produto.id),
  );

  if (itemExistente) {
    itemExistente.quantidade += 1;
  } else {
    carrinho.push({ ...produto, quantidade: 1 });
  }
  atualizarInterface();
}

function removerDoCarrinho(id) {
  // CORREÇÃO DE TIPAGEM: Previne que falhas de String vs Number quebrem a exclusão
  carrinho = carrinho.filter((item) => Number(item.id) !== Number(id));
  atualizarInterface();
}

function atualizarInterface() {
  tabelaCarrinho.innerHTML = "";
  let totalGeral = 0;

  carrinho.forEach((item, index) => {
    const totalItem = item.preco * item.quantidade;
    totalGeral += totalItem;

    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.nome}</td>
            <td>
              <input type="number" class="input-qtd-tabela" value="${item.quantidade}" min="1" onchange="alterarQuantidade(${item.id}, this.value)">
            </td>
            <td>R$ ${item.preco.toFixed(2)}</td>
            <td>R$ ${totalItem.toFixed(2)}</td>
            <td><button class="btn-deletar" onclick="removerDoCarrinho(${item.id})">❌</button></td>
        `;
    tabelaCarrinho.appendChild(tr);
  });

  txtTotal.textContent = `R$ ${totalGeral.toFixed(2)}`;
  calcularTroco();
}

window.alterarQuantidade = function (id, novaQtd) {
  // CORREÇÃO DE TIPAGEM: Busca segura dentro do carrinho
  const item = carrinho.find((i) => Number(i.id) === Number(id));
  if (item) {
    item.quantidade = Math.max(1, parseInt(novaQtd) || 1);
    atualizarInterface();
  }
};

// ========================================================
// 4. PAGAMENTO, TROCO E ENVIO DA VENDA
// ========================================================
selectPagamento.addEventListener("change", function () {
  if (selectPagamento.value === "dinheiro") {
    secaoTroco.style.display = "block";
  } else {
    secaoTroco.style.display = "none";
    inputRecebido.value = "";
    txtTroco.textContent = "R$ 0,00";
  }
});

inputRecebido.addEventListener("input", calcularTroco);

function calcularTroco() {
  const totalGeral = carrinho.reduce(
    (sum, item) => sum + item.preco * item.quantidade,
    0,
  );
  const recebido = parseFloat(inputRecebido.value) || 0;

  if (recebido >= totalGeral && totalGeral > 0) {
    const troco = recebido - totalGeral;
    txtTroco.textContent = `R$ ${troco.toFixed(2)}`;
  } else {
    txtTroco.textContent = "R$ 0,00";
  }
}

btnFinalizar.addEventListener("click", finalizarVenda);
window.addEventListener("keydown", function (e) {
  if (e.key === "F8") {
    finalizarVenda();
  }
});

async function finalizarVenda() {
  if (carrinho.length === 0) {
    // MELHORIA UI/UX: Alerta nativo substituído pelo Modal Customizado
    await chamarModal({
      titulo: "🛒 Carrinho Vazio",
      mensagem:
        "Adicione pelo menos um produto antes de tentar fechar a venda!",
    });
    return;
  }

  const totalVendaAtual = carrinho.reduce(
    (sum, item) => sum + item.preco * item.quantidade,
    0,
  );
  const metodoPagamento = selectPagamento.value;

  // MELHORIA UI/UX: Agora salvamos os itens comprados dentro do histórico de vendas
  const novaVenda = {
    id_venda: Date.now(),
    total: totalVendaAtual,
    metodo: metodoPagamento,
    data: new Date(),
    itens: [...carrinho], // ◄ Histórico completo preservado para relatórios futuros
  };

  try {
    const res = await fetch("/api/vendas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novaVenda),
    });

    if (res.ok) {
      // MELHORIA UI/UX: Alerta nativo substituído pelo Modal Customizado
      await chamarModal({
        titulo: "✅ Venda Finalizada",
        mensagem: `Venda registrada com sucesso via ${metodoPagamento.toUpperCase()}!`,
      });
      carrinho = [];
      inputRecebido.value = "";
      atualizarInterface();
      inputBusca.focus();
    } else {
      const dadosErro = await res.json();
      await chamarModal({
        titulo: "❌ Erro no Servidor",
        mensagem: dadosErro.erro || "Erro ao tentar registrar a venda.",
      });
    }
  } catch (error) {
    await chamarModal({
      titulo: "❌ Falha na Conexão",
      mensagem:
        "O servidor local parece estar offline. Verifique o terminal Node.js.",
    });
  }
}

// ========================================================
// 5. DROPDOWN FILTRADO EM TEMPO REAL
// ========================================================
inputBusca.addEventListener("input", function () {
  const termoBusca = inputBusca.value.trim().toLowerCase();
  if (termoBusca === "") {
    fecharDropdown();
    return;
  }

  const produtosFiltrados = produtosMock.filter(
    (p) =>
      p.codigo_barras.includes(termoBusca) ||
      p.nome.toLowerCase().includes(termoBusca),
  );

  if (produtosFiltrados.length > 0) {
    renderizarDropdown(produtosFiltrados);
  } else {
    fecharDropdown();
  }
});

function renderizarDropdown(produtos) {
  dropdownCustom.innerHTML = "";
  dropdownCustom.classList.remove("hidden");

  produtos.forEach((produto) => {
    const divItem = document.createElement("div");
    divItem.className = "dropdown-item";
    divItem.innerHTML = `
            <span class="item-nome">${produto.nome} <small style="color:#64748b; font-size:0.85em;">(${produto.codigo_barras})</small></span>
            <span class="item-preco">R$ ${produto.preco.toFixed(2)}</span>
        `;

    divItem.addEventListener("click", function () {
      adicionarAoCarrinho(produto);
      inputBusca.value = "";
      fecharDropdown();
      inputBusca.focus();
    });

    dropdownCustom.appendChild(divItem);
  });
}

function fecharDropdown() {
  dropdownCustom.innerHTML = "";
  dropdownCustom.classList.add("hidden");
}

document.addEventListener("click", function (e) {
  if (!inputBusca.contains(e.target) && !dropdownCustom.contains(e.target)) {
    fecharDropdown();
  }
});

// ========================================================
// 6. NAVEGAÇÃO ENTRE ABAS
// ========================================================
botoesAbas.forEach((botao) => {
  botao.addEventListener("click", () => {
    botoesAbas.forEach((b) => b.classList.remove("active"));
    botao.classList.add("active");

    const abaAlvo = botao.getAttribute("data-tab");

    abaCaixa.classList.add("hidden");
    abaCadastro.classList.add("hidden");
    abaRelatorio.classList.add("hidden");

    if (abaAlvo === "aba-caixa") {
      abaCaixa.classList.remove("hidden");
      inputBusca.focus();
    } else if (abaAlvo === "aba-cadastro") {
      abaCadastro.classList.remove("hidden");
      botoesSubAbas.forEach((b) => b.classList.remove("active"));
      botoesSubAbas[0].classList.add("active");
      subAbaFormulario.classList.remove("hidden");
      subAbaEstoque.classList.add("hidden");
      document.getElementById("novo-nome").focus();
    } else if (abaAlvo === "aba-relatorio") {
      abaRelatorio.classList.remove("hidden");
      atualizarRelatorioDiario();
    }
  });
});

botoesSubAbas.forEach((botao) => {
  botao.addEventListener("click", () => {
    botoesSubAbas.forEach((b) => b.classList.remove("active"));
    botao.classList.add("active");

    const subAlvo = botao.getAttribute("data-subtab");

    if (subAlvo === "sub-aba-formulario") {
      subAbaFormulario.classList.remove("hidden");
      subAbaEstoque.classList.add("hidden");
    } else {
      subAbaFormulario.classList.add("hidden");
      subAbaEstoque.classList.remove("hidden");
      atualizarTabelaEstoque();
    }
  });
});

// ========================================================
// 7. CADASTRO, EDIÇÃO E REMOÇÃO (Persistindo no produtos.json)
// ========================================================
formCadastro.addEventListener("submit", async function (e) {
  e.preventDefault();

  const nome = document.getElementById("novo-nome").value.trim();
  const codigo = document.getElementById("novo-codigo").value.trim();
  const preco = parseFloat(document.getElementById("novo-preco").value);

  const codigoJaExiste = produtosMock.some((p) => p.codigo_barras === codigo);
  if (codigoJaExiste) {
    // MELHORIA UI/UX: Alerta nativo substituído pelo Modal Customizado
    await chamarModal({
      titulo: "⚠️ Código Duplicado",
      mensagem: `Já existe um produto cadastrado com o código de barras "${codigo}"!`,
    });
    return;
  }

  const novoProduto = {
    id:
      produtosMock.length > 0
        ? Math.max(...produtosMock.map((p) => p.id)) + 1
        : 1,
    codigo_barras: codigo,
    nome: nome,
    preco: preco,
  };

  produtosMock.push(novoProduto);

  const salvo = await sincronizarEstoqueComServidor();
  if (salvo) {
    // MELHORIA UI/UX: Alerta nativo substituído pelo Modal Customizado
    await chamarModal({
      titulo: "✅ Produto Cadastrado",
      mensagem: `O produto "${nome}" foi adicionado com sucesso ao catálogo.`,
    });
    formCadastro.reset();
    document.getElementById("novo-nome").focus(); // Mantém o cursor pronto para o próximo item
  }
});

function atualizarTabelaEstoque() {
  tabelaEstoque.innerHTML = "";
  produtosMock.forEach((produto) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${produto.codigo_barras}</strong></td>
      <td>${produto.nome}</td>
      <td>R$ ${produto.preco.toFixed(2)}</td>
      <td>
        <button class="btn-editar" onclick="editarProdutoEstoque(${produto.id})">✏️ Editar</button>
        <button class="btn-deletar" onclick="removerDoEstoque(${produto.id})">🗑️ Remover</button>
      </td>
    `;
    tabelaEstoque.appendChild(tr);
  });
}

async function sincronizarEstoqueComServidor() {
  try {
    const res = await fetch("/api/produtos/salvar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(produtosMock),
    });
    return res.ok;
  } catch (error) {
    chamarModal({
      titulo: "❌ Erro",
      mensagem: "Não foi possível sincronizar o estoque com o servidor.",
    });
    return false;
  }
}

// ========================================================
// 8. RELATÓRIO DE FECHAMENTO DIÁRIO (Lendo do arquivo físico)
// ========================================================
async function atualizarRelatorioDiario() {
  try {
    const res = await fetch("/api/vendas");
    const todasAsVendas = await res.json();

    let somas = { dinheiro: 0, pix: 0, cartao: 0 };

    const tabelaVendasCorpo = document
      .getElementById("tabela-vendas-detalhes")
      .querySelector("tbody");
    tabelaVendasCorpo.innerHTML = "";

    todasAsVendas.forEach((venda, index) => {
      if (somas.hasOwnProperty(venda.metodo)) {
        somas[venda.metodo] += venda.total;
      }

      const horario = new Date(venda.data).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      let corBadge = "#10b981";
      if (venda.metodo === "pix") corBadge = "#06b6d4";
      if (venda.metodo === "cartao") corBadge = "#f59e0b";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${index + 1}</strong></td>
        <td>${horario}</td>
        <td><span class="badge" style="background-color: ${corBadge}; font-size: 0.85em; padding: 4px 8px;">${venda.metodo.toUpperCase()}</span></td>
        <td><strong>R$ ${venda.total.toFixed(2)}</strong></td>
      `;

      // NOVO: Adiciona o evento de clique na linha para abrir o detalhamento
      tr.addEventListener("click", () =>
        mostrarDetalhesDaVenda(venda, index + 1),
      );

      tabelaVendasCorpo.appendChild(tr);
    });

    const totalGeralAcumulado = somas.dinheiro + somas.pix + somas.cartao;

    document.getElementById("rep-dinheiro").textContent =
      `R$ ${somas.dinheiro.toFixed(2)}`;
    document.getElementById("rep-pix").textContent =
      `R$ ${somas.pix.toFixed(2)}`;
    document.getElementById("rep-cartao").textContent =
      `R$ ${somas.cartao.toFixed(2)}`;
    document.getElementById("rep-total-geral").textContent =
      `R$ ${totalGeralAcumulado.toFixed(2)}`;
  } catch (error) {
    console.error("Erro ao carregar relatório diário do servidor", error);
  }
}

// NOVA FUNÇÃO: Prepara os dados da venda clicada e abre o modal detalhado
async function mostrarDetalhesDaVenda(venda, numeroVenda) {
  const horario = new Date(venda.data).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  await chamarModal({
    titulo: `📋 Detalhes da Venda #${numeroVenda}`,
    mensagem: `Transação realizada às ${horario} via ${venda.metodo.toUpperCase()}.`,
    listaItens: venda.itens || [], // Passa o array de itens comprados para o modal
  });
}

// ========================================================
// 9. MOTOR DO MODAL CUSTOMIZADO (Atualizado)
// ========================================================
function chamarModal({
  titulo,
  mensagem,
  comInput = false,
  valorInput = "",
  tipoInput = "text",
  listaItens = null, // NOVO: Parâmetro opcional para receber a lista de itens
}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-custom");
    const txtTitulo = document.getElementById("modal-titulo");
    const txtMensagem = document.getElementById("modal-mensagem");
    const divInput = document.getElementById("modal-corpo-input");
    const inputTexto = document.getElementById("modal-input-texto");
    const btnCancelar = document.getElementById("btn-modal-cancelar");
    const btnConfirmar = document.getElementById("btn-modal-confirmar");

    // Elementos da tabela interna do modal
    const divVenda = document.getElementById("modal-corpo-venda");
    const tbodyModalItens = document.getElementById("modal-itens-linhas");

    txtTitulo.textContent = titulo;
    txtMensagem.textContent = mensagem;

    // Lógica para renderizar o input (Edição de estoque)
    if (comInput) {
      divInput.classList.remove("hidden");
      inputTexto.type = tipoInput;
      inputTexto.value = valorInput;
      setTimeout(() => inputTexto.select(), 60);
    } else {
      divInput.classList.add("hidden");
    }

    // NOVO: Lógica para renderizar os produtos caso seja um detalhamento de venda
    if (listaItens && listaItens.length > 0) {
      divVenda.classList.remove("hidden");
      tbodyModalItens.innerHTML = ""; // Limpa a tabela interna do modal

      listaItens.forEach((item) => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #f1f5f9";
        tr.innerHTML = `
          <td style="padding: 8px 10px; color: #1e293b;">${item.nome}</td>
          <td style="padding: 8px 10px; text-align: center; color: #475569;">${item.quantidade}</td>
          <td style="padding: 8px 10px; text-align: right; font-weight: 600; color: #1e293b;">R$ ${(item.preco * item.quantidade).toFixed(2)}</td>
        `;
        tbodyModalItens.appendChild(tr);
      });
    } else {
      divVenda.classList.add("hidden");
    }

    modal.classList.remove("hidden");

    function encerrarAcao(resposta) {
      modal.classList.add("hidden");
      btnConfirmar.removeEventListener("click", aoConfirmar);
      btnCancelar.removeEventListener("click", aoCancelar);
      resolve(resposta);
    }

    function aoConfirmar() {
      encerrarAcao(comInput ? inputTexto.value : true);
    }
    function aoCancelar() {
      encerrarAcao(null);
    }

    btnConfirmar.addEventListener("click", aoConfirmar);
    btnCancelar.addEventListener("click", aoCancelar);
  });
}

// ========================================================
// 10. FUNÇÕES DE REMOÇÃO E EDIÇÃO DO ESTOQUE FÍSICO
// ========================================================
window.removerDoEstoque = async function (id) {
  const produto = produtosMock.find((p) => p.id === id);
  if (!produto) return;

  const confirmado = await chamarModal({
    titulo: "🗑️ Remover do Estoque",
    mensagem: `Tem certeza de que deseja deletar permanentemente o produto "${produto.nome}" do sistema?`,
  });

  if (confirmado) {
    const index = produtosMock.findIndex((p) => p.id === id);
    if (index !== -1) {
      produtosMock.splice(index, 1);
      const exito = await sincronizarEstoqueComServidor();
      if (exito) atualizarTabelaEstoque();
    }
  }
};

window.editarProdutoEstoque = async function (id) {
  const produto = produtosMock.find((p) => p.id === id);
  if (!produto) return;

  const novoNome = await chamarModal({
    titulo: "✏️ Editar Nome do Produto",
    mensagem: "Modifique o nome de identificação deste item:",
    comInput: true,
    valorInput: produto.nome,
  });

  if (novoNome === null) return;
  if (novoNome.trim() === "") {
    await chamarModal({ titulo: "⚠️ Erro", mensagem: "Nome inválido!" });
    return;
  }

  const novoPrecoStr = await chamarModal({
    titulo: "💰 Editar Preço de Venda",
    mensagem: "Insira o novo valor base de mercado para o item:",
    comInput: true,
    valorInput: produto.preco,
    tipoInput: "number",
  });

  if (novoPrecoStr === null) return;
  const novoPreco = parseFloat(novoPrecoStr);
  if (isNaN(novoPreco) || novoPreco <= 0) {
    await chamarModal({ titulo: "⚠️ Erro", mensagem: "Preço inválido!" });
    return;
  }

  produto.nome = novoNome.trim();
  produto.preco = novoPreco;

  const exito = await sincronizarEstoqueComServidor();
  if (exito) atualizarTabelaEstoque();
};

// EXECUÇÃO INICIAL DO SISTEMA
carregarProdutosDoServidor();
