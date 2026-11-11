'use strict';

/* =========================================================
   Constantes e estado da aplicação
   ========================================================= */
const CHAVE_NOMES = 'sorteio:nomes';
const CHAVE_HISTORICO = 'sorteio:historico';
const DURACAO_SUSPENSE_MS = 2000;

let nomes = [];            // Lista de nomes; o número de cada um é a posição + 1
let historico = [];        // Sorteios já realizados: { numero, nome }
let indiceSorteado = null; // Índice da linha atualmente destacada na tabela
let sorteando = false;     // Indica se a animação de suspense está rodando

/* =========================================================
   Referências aos elementos da página
   ========================================================= */
const el = {
  form: document.getElementById('form-nome'),
  campo: document.getElementById('campo-nome'),
  erro: document.getElementById('erro-nome'),
  corpo: document.getElementById('corpo-tabela'),
  total: document.getElementById('total'),
  btnSortear: document.getElementById('btn-sortear'),
  btnLimpar: document.getElementById('btn-limpar'),
  resultado: document.getElementById('resultado'),
  resNumero: document.getElementById('res-numero'),
  resNome: document.getElementById('res-nome'),
  anuncio: document.getElementById('anuncio'),
  histTotal: document.getElementById('hist-total'),
  listaHistorico: document.getElementById('lista-historico'),
};

/* =========================================================
   Persistência (localStorage)
   ========================================================= */
function salvar() {
  try {
    localStorage.setItem(CHAVE_NOMES, JSON.stringify(nomes));
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
  } catch (e) {
    console.warn('Não foi possível salvar os dados:', e);
  }
}

// Lê uma lista do localStorage, descartando itens inválidos
function carregarLista(chave, ehValido) {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    return Array.isArray(dados) ? dados.filter(ehValido) : [];
  } catch (e) {
    return [];
  }
}

function carregar() {
  nomes = carregarLista(CHAVE_NOMES, (n) => typeof n === 'string');
  historico = carregarLista(
    CHAVE_HISTORICO,
    (h) => h && Number.isInteger(h.numero) && typeof h.nome === 'string'
  );
}

/* =========================================================
   Renderização
   ========================================================= */
function renderTabela() {
  el.corpo.replaceChildren();

  // Mensagem amigável quando não há nomes
  if (nomes.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'vazio';
    td.textContent = 'Nenhum nome adicionado ainda';
    tr.appendChild(td);
    el.corpo.appendChild(tr);
    return;
  }

  nomes.forEach((nome, i) => {
    const tr = document.createElement('tr');
    if (i === indiceSorteado) tr.classList.add('sorteada');

    const tdNum = document.createElement('td');
    tdNum.className = 'col-num';
    tdNum.textContent = i + 1;

    // textContent evita injeção de HTML
    const tdNome = document.createElement('td');
    tdNome.textContent = nome;

    const tdAcao = document.createElement('td');
    tdAcao.className = 'col-acao';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-remover';
    btn.dataset.indice = i;
    btn.textContent = 'Remover';
    btn.setAttribute('aria-label', `Remover ${nome} (nº ${i + 1})`);
    tdAcao.appendChild(btn);

    tr.append(tdNum, tdNome, tdAcao);
    el.corpo.appendChild(tr);
  });
}

function renderHistorico() {
  el.listaHistorico.replaceChildren();
  el.histTotal.textContent = historico.length;

  // Mais recentes primeiro
  [...historico].reverse().forEach((h) => {
    const li = document.createElement('li');
    li.textContent = `Nº ${h.numero} — ${h.nome}`;
    el.listaHistorico.appendChild(li);
  });
}

function atualizarControles() {
  const n = nomes.length;
  el.total.textContent = `${n} ${n === 1 ? 'nome' : 'nomes'}`;
  el.btnSortear.disabled = n === 0 || sorteando;
  el.btnLimpar.disabled = n === 0 || sorteando;
}

function renderTudo() {
  renderTabela();
  renderHistorico();
  atualizarControles();
}

function mostrarResultado(numero, nome) {
  el.resNumero.textContent = numero;
  el.resNome.textContent = nome;
}

function resetarResultado() {
  el.resNumero.textContent = '–';
  el.resNome.textContent = 'Aguardando sorteio';
  el.anuncio.textContent = '';
}

/* =========================================================
   Ações do usuário
   ========================================================= */
function adicionar(texto) {
  const nome = texto.trim(); // remove espaços do início e do fim

  if (nome === '') {
    el.erro.textContent = 'Digite um nome antes de adicionar.';
    el.campo.focus();
    return;
  }

  el.erro.textContent = '';
  nomes.push(nome); // nomes repetidos são permitidos
  salvar();
  renderTudo();

  el.campo.value = '';
  el.campo.focus();

  // Mantém a última linha visível dentro da tabela
  const wrap = el.corpo.closest('.tabela-wrap');
  wrap.scrollTop = wrap.scrollHeight;
}

function remover(indice) {
  if (sorteando || indice < 0 || indice >= nomes.length) return;

  nomes.splice(indice, 1); // os números se ajustam sozinhos (posição + 1)

  // Mantém o destaque na linha certa após a renumeração
  if (indiceSorteado === indice) indiceSorteado = null;
  else if (indiceSorteado !== null && indice < indiceSorteado) indiceSorteado--;

  salvar();
  renderTudo();
}

function limparTudo() {
  if (sorteando || nomes.length === 0) return;
  if (!confirm('Tem certeza que deseja apagar todos os nomes e o histórico?')) return;

  nomes = [];
  historico = [];
  indiceSorteado = null;
  salvar();
  resetarResultado();
  renderTudo();
  el.campo.focus();
}

/* =========================================================
   Sorteio com animação de suspense
   ========================================================= */
function sortear() {
  if (sorteando || nomes.length === 0) return;

  sorteando = true;
  indiceSorteado = null;
  el.anuncio.textContent = '';
  el.resultado.classList.add('girando');
  renderTudo();

  // Define o resultado final logo no início
  const sorteado = Math.floor(Math.random() * nomes.length);

  // Respeita quem prefere menos animação
  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duracao = reduzirMovimento ? 0 : DURACAO_SUSPENSE_MS;

  const inicio = Date.now();
  let atraso = 50; // a troca de números vai desacelerando

  function passo() {
    if (Date.now() - inicio >= duracao) {
      finalizarSorteio(sorteado, reduzirMovimento);
      return;
    }
    const i = Math.floor(Math.random() * nomes.length);
    mostrarResultado(i + 1, nomes[i]);
    atraso *= 1.06;
    setTimeout(passo, atraso);
  }

  passo();
}

function finalizarSorteio(indice, reduzirMovimento) {
  sorteando = false;
  indiceSorteado = indice;

  const numero = indice + 1;
  const nome = nomes[indice];

  historico.push({ numero, nome });
  salvar();

  el.resultado.classList.remove('girando');
  mostrarResultado(numero, nome);
  el.anuncio.textContent = `Número ${numero} sorteado: ${nome}`; // aria-live

  renderTudo();

  // Rola até a linha sorteada
  const linha = el.corpo.querySelector('tr.sorteada');
  if (linha) {
    linha.scrollIntoView({
      block: 'center',
      behavior: reduzirMovimento ? 'auto' : 'smooth',
    });
  }
}

/* =========================================================
   Eventos
   ========================================================= */
// Enter dentro do campo também dispara o submit do formulário
el.form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  adicionar(el.campo.value);
});

el.campo.addEventListener('input', () => {
  el.erro.textContent = '';
});

// Delegação de eventos: um único listener para todos os botões "Remover"
el.corpo.addEventListener('click', (evento) => {
  const botao = evento.target.closest('button[data-indice]');
  if (botao) remover(Number(botao.dataset.indice));
});

el.btnSortear.addEventListener('click', sortear);
el.btnLimpar.addEventListener('click', limparTudo);

/* =========================================================
   Inicialização
   ========================================================= */
carregar();
renderTudo();