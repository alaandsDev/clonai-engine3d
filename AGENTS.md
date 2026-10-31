# Engine3D

Para produção, leia `AGENT_PRODUCTION_RULES.md` e `docs/production/CONTRACTS_AND_GATES.md`. Script Mode exige ProductionPreflight antes do render: BLOCKER impede produção; WARNING permanece no relatório. Política: FIRST_RENDER_IS_FINAL_CANDIDATE. Desenvolvimento da engine e produção certificada têm escopos distintos.

REUSE BEFORE CREATE: antes de criar recurso, consultar `out/engine3d/catalog.json`, buscar ID e tags, conferir capabilities e compatibilidade. Reutilizar recursos compatíveis; criar somente se não houver equivalente. Atualizar catálogo e testes ao adicionar recurso.

Vídeos são JSON, nunca componentes TSX específicos. Não incluir LLM, modelos externos, SaaS ou backend. Render deve ser função determinística de spec/frame/fps/resolução. Não usar relógio real ou aleatoriedade sem seed. Não executar npm audit fix nem atualizar versões automaticamente. Falhar explicitamente antes do render. Testes de unidade não dependem de internet. Não publicar nem configurar remote.
