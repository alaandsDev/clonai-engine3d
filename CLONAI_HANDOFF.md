# ClonAI — handoff do checkpoint lógico Phase26 + Phase26B

Atualização de finalização em 2026-10-29. Esta seção é o estado atual; o handoff da Fase20 permanece integralmente abaixo como histórico. Suas referências a master, Fase21 não iniciada e migração inicial não descrevem o checkout atual.

## Estado aprovado para o checkpoint

- Projeto/repositório: clonai-engine3d, `alaandsDev/clonai-engine3d`, privado; branch `main`.
- Checkpoint anterior oficial: `19d55834c38d0fdf3dea86c4708cdf0db637dd63` (Phase25).
- Phase26 COMPLETE; Phase26B COMPLETE; P14/P15/P16 PASS nos mínimos definidos.
- Inicial Phase26: INCOMPLETE, 2/8 useful, 2/8 ADEQUATE/RICH, 2/8 Writer eligible. Histórico preservado em PHASE26_REPORT.md.
- Após Phase26B: 6/8 useful mechanism knowledge; 6/8 story ADEQUATE/RICH; 6/8 Writer eligible.
- Process knowledge PARTIAL; mechanism extraction PARTIAL; generalização limitada, PASS na bateria definida.
- Zero RICH, zero cadeias reais Problem/Solution, maior cadeia física real de 1 aresta e MechanismChainCoverage = 0 nos oito casos.
- Phase27Readiness PARTIAL: 6 PARTIAL, 2 NOT_READY, 0 READY. LEVEL4C+ mantido.
- Registry: Engine3D 50 / SFX 8 / VISUAL 5. Nenhum recurso ou vídeo novo nesta finalização.
- Phase27 NOT STARTED. Esta finalização não autoriza iniciar implementação ou design da fase seguinte.

| Caso | Relações | Story | Writer | Palavras |
|---|---:|---|---|---:|
| A — poço | 4 | ADEQUATE | SCRIPT_GROUNDED | 64 |
| B — turbina | 4 | ADEQUATE | SCRIPT_GROUNDED | 97 |
| C — motor a jato | 4 | ADEQUATE | SCRIPT_GROUNDED | 63 |
| D — bomba d'água | 0 | INSUFFICIENT | BLOCKED | 0 |
| E — geladeira | 0 | INSUFFICIENT | BLOCKED | 0 |
| F — elevador | 9 | ADEQUATE | SCRIPT_GROUNDED | 138 |
| G — usina hidrelétrica | 3 | ADEQUATE | SCRIPT_GROUNDED | 50 |
| H — tratamento de água | 3 | ADEQUATE | SCRIPT_GROUNDED | 117 |

São 27 relações finais, 18 novas e 24 usadas pelo Writer. Revisão manual finita dos snapshots: 27 CORRECT, 0 QUESTIONABLE final, 0 WRONG final e Writer-used Wrong = 0. Isso mede suporte no snapshot, sem demonstrar corroboração independente geral ou verdade universal. D permanece bloqueado por identidade; E não teve aquisição no snapshot após HTTP429. Recusas deliberadas de A/B/G e ausência de segunda origem útil geral continuam limites.

## KnowledgeLossTrace e interpretação

Ler PHASE26_REPORT.md e src/curiosity/knowledge-loss.ts. Um automatic passage join indica pelo menos uma relação, sem certificar compreensão de todas as orações. Quando nenhum candidate é emitido, subject/relation internals permanecem UNKNOWN. As dez janelas revisadas são diagnósticos, não denominador de recall nem Evidence manual. A oração principal de G foi recuperada, mas sua relativa/coreferência não; a hipótese preliminar de antecedente foi revisada e a atribuição ambígua continua recusada. USED_FOR não é SOLVES; propósito não é causa efetiva.

## Retomada pelo repositório

Ler AGENTS.md, esta seção, PHASE26_REPORT.md, PHASE25_REPORT.md e PHASE24_REPORT.md; depois src/curiosity/README.md e os contratos relevantes. Conferir branch, HEAD e árvore de trabalho antes de agir. O relatório consolidado preserva o resultado inicial INCOMPLETE e documenta limites de narrativa, conexão e fonte.

A rota factual PROCESS usa mechanismVersion2 e contextualMechanisms:true de forma opt-in. Sem o opt-in, os caminhos históricos continuam disponíveis. Knowledge, graph, story e Writer são derivados das evidências admitidas; contexto e intents editoriais não adicionam relações factuais ou prova visual. SCRIPT_GROUNDED não significa MP4 ou visual production eligible.

Os 21 comandos finais foram reexecutados: PASS, 961 testes únicos (não somar as suítes especializadas). Replay reexecutado antes desta atualização documental: 16 processamentos, 8 KnowledgeLossTrace, 4 referências históricas e 12 estágios puros Phase25; fingerprints iguais, ZERO NETWORK. Anti-hardcode PASS, 190 arquivos de runtime, 0 BLOCKER e controle negativo detectado. Segurança HTTP/SSRF/DNS/socket/redirect/robots/MIME/charset/limites preservada; sem atualização de dependências.

Os helpers de tools/phase26/ e tools/phase26b/ são operadores do checkpoint de implementação, com paths ignorados e algumas verificações fixadas ao HEAD anterior e ao handoff antigo. O hash histórico do handoff corresponde à versão recuperável via `git show 19d55834c38d0fdf3dea86c4708cdf0db637dd63:CLONAI_HANDOFF.md`; esta revisão de documentação foi feita depois do replay. Não regravar baselines ou executar geradores de relatório históricos sem revisar os seus destinos.

Git não transporta out/, snapshots adquiridos, vídeos, caches, previews ou áudios derivados. Para reprodução exata, preservar separadamente out/engine3d/phase26/, inclusive phase26b-baseline/, phase26b/attempts/final/, reviews, aquisições e referências históricas usadas pelo replay. Na ausência desses artifacts, reportar indisponibilidade em vez de fazer nova pesquisa e chamá-la de replay. Não incluir esses diretórios no commit nem expor configurações/credenciais.

## Finalização autorizada

A orientação específica de finalização autoriza um único commit com mensagem `Phase26 causal curiosity and contextual mechanism recovery` e push normal para origin/main. Não autoriza force-push, tag, nova arquitetura, novos assets ou Phase27. O SHA deste próprio commit não é incorporado ao arquivo; conferir `git rev-parse HEAD`, o pai Phase25 e `git ls-remote origin refs/heads/main` para a identidade publicada. A confirmação operacional consta da resposta de finalização.

---

# Handoff histórico da Fase20 — preservado integralmente

# ClonAI — handoff após a Fase 20

Estado registrado em 2026-10-28. Este documento permite retomar o projeto pelo código e pelos relatórios, sem depender do histórico de uma conta de chat.

## 1. Identidade do projeto e Git

Este checkout é **clonai-engine3d**: engine local para produção de vídeos 3D verticais com pesquisa factual rastreável.

- Pasta original: `C:\Users\aland\Desktop\projects\clonai`.
- Branch local: `master`; a migração autorizada usa a branch remota `main`, preservando o nome local.
- Último commit observado antes da preparação do handoff: `e610b82` — `Document architecture commands delivered media and current limitations`.
- Antes da migração havia alterações e arquivos novos das fases posteriores ainda **sem commit**. O commit de migração deve incluí-los junto deste handoff; publicar apenas o HEAD antigo não transfere esse trabalho.
- Não havia remoto configurado inicialmente. O proprietário autorizou depois criar um repositório privado separado e enviar o checkout completo. A autorização é específica desta migração; não autoriza futuras publicações ou mudanças de acesso.

Destino criado e conferido como **privado**: **https://github.com/alaandsDev/clonai-engine3d**. Remoto planejado: `origin` com URL `https://github.com/alaandsDev/clonai-engine3d.git`; publicação em `main`. A confirmação operacional de commit/push deve ser feita com `git status`, `git log -1`, `git remote -v` e comparação do HEAD com `refs/heads/main` no remoto; o documento não incorpora seu próprio hash de commit.

O conector encontrou **https://github.com/alaandsDev/clonai**, público, com default branch `main`. O `main` consultado contém outro conjunto de componentes: React 19/Vite, `server/local.ts`, Workers/Cloudflare e um renderizador FFmpeg para vídeos de motivação. Seu `package.json` se chama `clonai`; o deste checkout se chama `clonai-engine3d`, com React 18/Three/Remotion. `PHASE20_REPORT.md` não foi encontrado nesse `main`.

**O proprietário escolheu manter os repositórios separados.** Não substituir o `main` de `alaandsDev/clonai`, não fazer force-push e não juntar os projetos automaticamente. A engine será transportada no repositório privado `alaandsDev/clonai-engine3d`.

## 2. Ler primeiro

1. `AGENTS.md` — regras do projeto.
2. `AUDIT.md` — auditoria inicial e restrições históricas.
3. `PHASE20_REPORT.md` — estado mais recente, 44 seções, 29 gates e respostas obrigatórias.
4. `PHASE19_REPORT.md` — grounding e EvidencePack.
5. `src/research/README.md`, `src/research/web/README.md` e `src/writer/README.md`.
6. `src/engine3d/README.md`, `src/engine3d/DIRECTED.md` e `src/engine3d/DEMONSTRATION.md`.
7. `src/sound/README.md` e `src/visual/README.md` antes de usar o pack de edição.

Relatórios das Fases 6B e 9–20 estão na raiz. O código, os testes e os contratos são a referência operacional; uma frase em relatório não substitui seus preflights.

## 3. Arquitetura

```text
ResearchRequest/topic
  → ResearchPlan
  → SearchProvider → CandidateSources → secure HTTP → immutable snapshots
  → Phase19 EvidencePack → Evidence → GroundedFacts/conflicts/ranking
  → GROUNDED_ONLY Writer → factual preflight → semantic reconciliation
  → Semantic/Narrative/Auto Director → factual/visual matrix
  → planos JSON / DirectorPlan → Engine3D → Three/R3F → Remotion
  → edge-tts + FFmpeg → MP4, quando os gates de produção permitem
```

O provider web obtém snapshots; a Fase 19 permanece como único núcleo de evidências, fatos, conflitos, ranking e grounding. `STATIC_SOURCE_PACK` continua disponível. Snippet/título de busca não pode virar evidência. A evidência deve apontar para texto exato e offsets do snapshot com SHA256.

Mapeamento do código:

| Pasta | Responsabilidade |
|---|---|
| `src/engine3d/` | Recursos procedurais, direção, movimento, demonstrações e render |
| `src/editorial/`, `src/sound/`, `src/visual/` | Eventos editoriais, SFX e composição de mídia |
| `src/semantics/`, `src/narrative/`, `src/autodirector/` | Compreensão limitada, grafo, planejamento e compilação |
| `src/writer/` | Writer determinístico e caminho GROUNDED_ONLY |
| `src/research/` | Policy, fontes, extração, fatos, ranking, grounding e QA |
| `src/research/web/` | Busca, seleção, HTTP seguro, robots, cache, sessão e replay |
| `cli/`, `examples/`, `tests/` | Comandos, entradas de exemplo e regressão |

## 4. Estado factual validado da Fase 20

| Medida | Resultado registrado |
|---|---|
| Gates / comandos exigidos | 29/29 e 14/14 PASS |
| Suíte rápida | 649 testes: 534 anteriores + 115 web |
| Testes research / web | 50 / 115 PASS |
| Engine3D / SFX / VISUAL | 50 / 8 / 5; nenhum recurso novo |
| Duas sessões web finais | 7 queries, 21 resultados, 10 tentativas e 9 fontes aceitas |
| Provider / diversidade | MediaWiki REST público; um corpus e um domínio |
| Cold Places | REAL_RESEARCH_BLOCKED; 0/5 itens elegíveis com quórum de duas origens |
| Segundo tema de temperatura | Um fato SUPPORTED, uma origem, roteiro GROUNDED_ONLY aprovado |
| Roteiro aprovado | Zero claims sem evidência e zero semantic drift detectado |
| Corroboration real | Zero CORROBORATED |
| Replay | Dois resultados reconstruídos offline, fingerprints iguais e zero chamadas de rede |
| Mídia histórica | 12 MP4 preservados por SHA256; nenhum novo MP4 na Fase 20 |

Nível: **LEVEL 4C experimental**, apenas no domínio fechado demonstrado de temperatura/presença literal. Não é pesquisa universal, não é LEVEL5 e não significa que o ranking Cold Places foi concluído. Aceitação de uma fonte/grounding de uma citação não certifica verdade universal.

`PRODUCTION_ELIGIBLE` no writer do segundo piloto é um resultado de preflight: não houve áudio/duração final medidos nem novo master renderizado. A prova visual cobre o valor e o rótulo num display; não representa a cidade nem sua população.

## 5. Preparar uma máquina nova

Versões observadas na máquina de validação: Node **24.15.0**, Python **3.14.4**, `edge-tts==7.3.1` e `imageio-ffmpeg==0.6.0`. São versões observadas, não uma promessa de compatibilidade com qualquer ambiente. O `package-lock.json` fixa as dependências Node; não atualizar versões para iniciar a migração.

Após obter o checkout correto:

```powershell
node --version
python --version
npm ci
python -m pip install -r requirements.txt
npm run typecheck
npm run check:engine3d
```

`requirements.txt` fixa apenas edge-tts. FFmpeg/ffprobe também são necessários para os testes de integração e os renders. O projeto usa um FFmpeg existente no PATH, `CLONAI_FFMPEG`, ou uma instalação existente de `imageio_ffmpeg`; não instala esses binários automaticamente pelo runtime. Se não houver FFmpeg disponível e essa for a opção escolhida no ambiente novo:

```powershell
python -m pip install imageio-ffmpeg==0.6.0
```

Variáveis locais reconhecidas:

- `PYTHON`: executável Python para TTS/ferramentas.
- `CLONAI_FFMPEG`: executável FFmpeg existente, opcional se houver outro meio de descoberta.
- `FFPROBE_PATH`: executável ffprobe; o default atual aponta para o compositor Windows instalado em `node_modules`.
- `CLONAI_MEDIA_ROOT`: raiz externa do pack original, exigida para usar seus arquivos reais.

Narração de produção: `pt-BR-AntonioNeural`, rate `+0%`, pitch `+0Hz`. `edge-tts` real requer rede; testes rápidos não devem depender desse serviço. Não reduzir texto, trocar voz, acelerar áudio ou substituir narração por fake para contornar falhas de produção.

## 6. Revalidar o projeto

Comandos exigidos na Fase 20:

```powershell
npm run typecheck
npm run check:engine3d
npm run check:editorial
npm run check:sound
npm run check:visual
npm run check:motion
npm run check:demonstration
npm run check:autodirector
npm run check:semantics
npm run check:narrative
npm run check:writer
npm run check:research
npm run check:web-research
npm run engine3d:catalog
```

Não somar os testes dos comandos especializados como se fossem casos diferentes. Os 649 testes rápidos já incluem os 115 web. Sound/visual integration usam ferramentas locais e fixtures controladas; não precisam baixar o pack original nem aprovar mídia real. Falhas de ferramenta/ambiente em uma máquina nova devem ser diagnosticadas antes de alterar contratos.

## 7. Pesquisa web e replay

Entradas portáveis, copiadas das entradas dos pilotos finais sem acrescentar entidades, valores ou source packs:

- `examples/research/web-cold-request.json`.
- `examples/research/web-measurements-request.json`.

```powershell
npm run research:web -- examples/research/web-cold-request.json
npm run research:web -- examples/research/web-measurements-request.json
```

Esses comandos usam rede pública e escrevem em `out/engine3d/phase20/`. A web pode mudar; uma nova execução pode produzir outros snapshots/resultados. Para preservar a evidência histórica, fazer o backup dos artefatos existentes **antes** de executar novamente com os mesmos IDs.

Com os arquivos originais de sessão restaurados:

```powershell
npm run research:web:inspect -- out/engine3d/phase20/logs/real-cold-places.json
npm run research:web:replay -- out/engine3d/phase20/logs/real-cold-places.json
npm run research:web:replay -- out/engine3d/phase20/logs/real-temperature-records.json
```

Replay reprocessa snapshots e compara fingerprints; não refaz a busca. A política e as versões do parser precisam ser compatíveis. Não usar snapshots antigos como se tivessem sido descobertos na execução atual. Não chamar uma sessão incompleta de ranking pronto.

## 8. O que Git não transporta sozinho

O `.gitignore` exclui `out/`, `public/audio/`, dependências, caches, ambientes Python e configurações/credenciais locais. Portanto um push apenas do código **não** transporta todos os resultados históricos.

Preservar separadamente, caso seja necessário continuar/reproduzir o estado exato:

1. **`out/engine3d/` completo**: MP4, planos, áudios derivados, previews, logs, reviews, aprovações humanas, snapshots e caches de pesquisa. Os helpers históricos de várias fases também estão sob `out/`.
2. **`public/audio/`**: cache TTS existente. Sem ele, uma nova síntese depende da disponibilidade do serviço e não garante os mesmos bytes.
3. **Pack de mídia original externo**, mantendo paths relativos e hashes, e configuração local de `CLONAI_MEDIA_ROOT`. Os registries versionados contêm metadados, não os arquivos de áudio/imagem/vídeo originais.
4. **Configurações necessárias da máquina**, recriadas por meio privado. Não colocar chaves ou credenciais no handoff/repositório.
5. **Checkout local atual com `.git` e alterações não commitadas**, enquanto o primeiro commit/push completo ainda não tiver sido confirmado. Dependências instaladas podem ser recriadas; os arquivos de trabalho sem commit não aparecem num clone remoto.

Na Fase 20, priorizar os seguintes artefatos dentro desse backup:

- `out/engine3d/phase20/logs/real-cold-places.json` e `real-temperature-records.json`.
- `sources/raw/`, `sources/normalized/`, `cache/`, `inputs/` e `review/`.
- `real-source-manifest.json`, `search-trace.json`, `anti-hardcode.json`.
- `analysis/completion.json`, `checks.json`, `gates.json`, `integrity.json`, `performance.json` e `replay-verification.json`.

Não incluir `out/` inteiro em um `git add -f` para tentar resolver a migração: ele contém renders/caches volumosos e dados de fonte adquiridos. Definir um transporte privado de artefatos com o proprietário quando necessário. A troca de conta na mesma máquina não exige apagar ou recriar essas pastas.

## 9. Aprovações humanas preservadas

O histórico autorizou `SFX_IMPACT_001` para `hook_sfx`/IMPACT e `GRAPHIC_ARROW_001` para `event_thermometer_focus`/DIRECTION/ALPHA. Também aprovou o lote da Fase12 com 10 usos de SFX e três setas, exclusivamente nos eventos `cp12_*` revisados.

As aprovações são por evento/contexto/role/hash; não são aprovação global de todo asset ou pack. Restaurar os registros completos e conferir hashes/contextos antes de reutilizar. Este resumo não substitui manifests nem autoriza usos novos. A Fase12 aceitou cerca de 80 s para preservar roteiro e voz; isso não alterou automaticamente a duração-alvo de vídeos futuros.

## 10. Regras para continuar

- Ler e respeitar `AGENTS.md`; não publicar nem configurar remoto sem uma nova orientação explícita que resolva o destino.
- Vídeos são planos JSON; não criar TSX dedicado por vídeo.
- Reutilizar recursos/catalog IDs antes de criar; manter registro 50/8/5 até outra fase autorizada.
- Não adicionar LLM, APIs pagas, SaaS, backend, música ou assets para disfarçar gaps.
- Não executar `npm audit fix`, atualizar versões ou redefinir o checkout durante a migração.
- Não transformar snippet, source de baixa qualidade, staff temporário ou memória interna em fato/ranking.
- Factualidade, prova visual e produção com áudio/duração medidos são gates distintos.
- Respeitar SSRF, robots, limites e bloqueios; sem bypass de paywall/login/CAPTCHA/anti-bot.

## 11. Próximo trabalho

A Fase20 terminou. A Fase21 **não foi iniciada**. Único próximo investimento recomendado: **B) Web research v2**, priorizando origens primárias, diversidade de corpus/domínios e seleção por relevância/coverage. Não implementar esse próximo investimento apenas por ler este documento.

Prompt de retomada sugerido:

> Leia AGENTS.md, CLONAI_HANDOFF.md, AUDIT.md e PHASE20_REPORT.md. Confirme que este é o checkout clonai-engine3d, verifique Git e dependências, e distinga código versionado de artefatos restaurados. Preserve alterações existentes e aprovações humanas. A Fase20 está completa com pesquisa de temperatura limitada; Cold Places segue bloqueado. Não iniciar Fase21, publicar, atualizar dependências ou alterar o main remoto sem pedido explícito. Primeiro apresente o estado verificado e o que falta para a tarefa que eu solicitar.
