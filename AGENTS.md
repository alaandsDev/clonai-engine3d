# Engine3D

REUSE BEFORE CREATE: antes de criar recurso, consultar `out/engine3d/catalog.json`, buscar ID e tags, conferir capabilities e compatibilidade. Reutilizar recursos compatíveis; criar somente se não houver equivalente. Atualizar catálogo e testes ao adicionar recurso.

Vídeos são JSON, nunca componentes TSX específicos. Não incluir LLM, modelos externos, SaaS ou backend. Render deve ser função determinística de spec/frame/fps/resolução. Não usar relógio real ou aleatoriedade sem seed. Não executar npm audit fix nem atualizar versões automaticamente. Falhar explicitamente antes do render. Testes de unidade não dependem de internet. Não publicar nem configurar remote.
