import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('apps-script/Desligados-prod.gs', 'utf8');
const day = 86400000;
const ago = days => new Date(Date.now() - days * day);
const expected = [
  ['Barra Funda', 'maria.sousa@dafiti.com.br', 'erivaldo.siqueira@dafiti.com.br'],
  ['Belo Horizonte', 'leila.gomes@dafiti.com.br', 'saulo.junior@dafiti.com.br,erivaldo.siqueira@dafiti.com.br'],
  ['Extrema', 'guilherme.santos@dafiti.com.br', 'erivaldo.siqueira@dafiti.com.br'],
];
function run(rows) {
  const sent = [];
  const data = [['COLABORADOR', 'FILIAL', 'DESLIGAMENTO', 'Equip. Devolvido'], ...rows];
  const context = vm.createContext({
    Date, console,
    SpreadsheetApp: { openById: () => ({ getSheets: () => [{
      getLastRow: () => data.length, getDataRange: () => ({ getValues: () => data }),
    }] }) },
    Utilities: { formatDate: d => d.toISOString().slice(0, 10) },
    MailApp: { sendEmail: email => sent.push(email) },
  });
  vm.runInContext(source, context);
  context.enviarAlertasPrioridadeAlta();
  return sent;
}
const rows = expected.flatMap(([branch], i) => [
  ['Pendente-' + i, branch, ago(10), 'Pendente'],
  ['Devolvido-' + i, branch, ago(20), 'Devolvido'],
  ['Desligamento-' + i, branch, ago(20), 'Desligamento'],
  ['Recente-' + i, branch, ago(3), 'Pendente'],
  ['Futuro-' + i, branch, ago(-10), 'Pendente'],
]);
const sent = run(rows);
assert.equal(sent.length, 3);
expected.forEach(([branch, to, cc], i) => {
  const mail = sent.find(email => email.to === to);
  assert.ok(mail);
  assert.equal(mail.cc, cc);
  assert.ok(mail.subject.endsWith(branch));
  assert.ok(mail.htmlBody.includes('Pendente-' + i));
  expected.forEach((_, j) => { if (i !== j) assert.ok(!mail.htmlBody.includes('Pendente-' + j)); });
  for (const prefix of ['Devolvido-', 'Desligamento-', 'Recente-', 'Futuro-']) assert.ok(!mail.htmlBody.includes(prefix));
});
assert.equal(run([]).length, 0);
const onlyBh = run([['Pessoa <teste>', 'BH', ago(9), 'Pendente']]);
assert.equal(onlyBh.length, 1);
assert.equal(onlyBh[0].to, expected[1][1]);
assert.ok(onlyBh[0].htmlBody.includes('Pessoa &lt;teste&gt;'));
console.log('Alertas: destinatários, CC, isolamento por filial, status, prazo e ausência de pendências verificados sem envio real.');
