# Recursos procedurais de aviação e diagramas

Recursos genéricos registrados, sem roteiro, câmera ou vídeo embutido nos componentes:

| ID | Convenção local | Uso |
| --- | --- | --- |
| `PROP_AIRCRAFT_001` | Nariz em +X, altura em +Y, envergadura em Z | Avião estilizado com asas, cauda, motores e janelas; sem marca/fabricante |
| `PROP_AIRFOIL_001` | Bordo de ataque em +X; seção em XY; extensão em Z | Perfil fechado e espesso, editado para ilustração |
| `PROP_VECTOR_ARROW_001` | Base em Y=0, ponta em Y=1 | Vetor de diagrama; direção e comprimento por rotation/scale em JSON |

A seta aceita `palette` de 0 a 3: verde, vermelho, azul e ocre. Usa material sem iluminação e sobreposição de diagrama para permanecer legível quando a projeção atravessa outro objeto. Não é uma peça física que deva sofrer oclusão por uma carenagem.

Orçamentos conservadores em `PROP_MESHES`: avião 48, perfil 2, seta 2. Os testes de `aeronautics.test.ts` percorrem a geometria sem navegador/rede, conferem limites, perfil fechado, seta unitária, determinismo e cobertura do orçamento. O catálogo é regenerado pelo comando existente `npm run engine3d:catalog`.

Transformações, vínculos parentId, visibilidade, câmeras e frames continuam nos contratos `VisualDemonstration`/`DirectedSequence`. Nenhum recurso calcula sustentação, pressão, estabilidade ou trajetória de voo. Uma seta pode ilustrar uma força; seu comprimento não é automaticamente uma medida dessa força.

Produção de exemplo: `tools/production/aviao.ts`, com artifacts em `out/engine3d/production/aviao/`. As fontes factuais são documentadas separadamente em `fontes.md`; a geometria nunca se torna Evidence por ser desenhada.
