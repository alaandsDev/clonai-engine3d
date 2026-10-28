# Visual Demonstration v1

`NarrativeClaim → VisualDemonstration → compileDemonstration → DirectedSequence → DirectedRenderer`.

Não existe outro renderer de vídeo. O compilador em `demonstration.ts` retorna `{compilerVersion, fingerprint, sequence}`. É função pura: não acessa arquivos, rede, relógio ou AI. SHA-256/canonical JSON usam a função de fingerprint existente. O cliente browser importa somente os contratos/runtime, sem o módulo Node de hash.

Exemplos autorados: `examples/demonstration/car-freezing.json` e `process.json`. A composição Remotion existente `DirectedSequence` recebe `inputProps: {direction: result.sequence}`. `npm run check:demonstration` verifica os contratos.

## Dados e ownership

Uma demonstração declara claim, purpose, subjects, initialState, steps, finalState, presenterModes e uma direção-base. A versão é `demonstration-compiler/1.0.0`. O compilador adiciona uma trilha opcional `demonstration` ao DirectedSequence e emite SequenceState inicial/final completos; não muda o schema DirectorPlan/ShotSpec. Props controlados pela demonstração não podem concorrer com PropMotion/action target de direção no mesmo documento.

O runtime avalia qualquer frame partindo do estado inicial. O resultado persiste após cada operação; não há singleton ou dependência da ordem de frames. Estado final declarado da demonstração deve coincidir com sua evolução. O endpoint global da direção é derivado e validado pelo compilador. Steps têm progress normalizado entre startFrame/endFrame, easing explícito e purpose. Em endFrame o endpoint é aplicado; shots/modes usam janelas end-exclusive. Overrides de transição exigem reason explícita.

## Asset, state, behavior, phenomenon

O único novo asset é `PROP_CAR_001`: carro procedural sem marca, com geometria limitada. NORMAL/FROSTED/FROZEN são definições de estado, não novos IDs. `frost` 0..1 dirige cor e até 12 placas fixas; parâmetros/visualModifiers das definições são consumidos pela geometria. Não há simulação térmica.

O fenômeno de congelamento é composto por REVEAL, ACCUMULATE, CHANGE_STATE e HIGHLIGHT, mais câmera já existente. Não existe FREEZE_CAR nem DRILL_GROUND.

## Operations

- APPEAR/REVEAL mostram o subject no início; HIDE/DISAPPEAR o ocultam no endpoint. A visibilidade persiste. Não prometem dissolve/shader de transparência.
- MOVE/ROTATE/SCALE interpolam transforms; origem deve coincidir com o estado anterior.
- CHANGE_STATE valida estados/transições declaradas. V1 certifica os três estados do carro; outros props não recebem estados fictícios.
- ACCUMULATE aceita frost; INCREASE/DECREASE interpolam parâmetros suportados (frost, fillLevel, value ou modifiers ambientais numéricos). Direção monotônica e início do valor são verificados.
- CONNECT/SEPARATE interpolam a relação visível de um PATH. FLOW exige conexão pronta no início e path coincidente; progress 0..1 determina comprimento/front da linha azul, direction inverte o caminho, speed escala o avanço normalizado, amount determina espessura. Não existe conservação/pressão/solver de fluido automático.
- HIGHLIGHT é um pulso limitado: até .25 de brilho nas primitivas e até 2,5% de escala; props existentes recebem o pequeno pulso de escala. Volta a zero.

## Primitivas locais

BOX, CYLINDER, PATH e LAYER são tipos matemáticos de geometria em um subject JSON, sem resourceId, nome de modelo, malha externa ou registro reutilizável de Pipe/Reservoir. CYLINDER é composto de parede/base e volume interno de altura fillLevel; PATH de segmentos cilíndricos. Isso serve ao diagrama local de transferência, sem criar assets disfarçados com identidade/domain mesh. PROP referencia e valida um ID/instância existente.

LAYER declara surface/subsurface/deep com cor/tamanho/placement explícitos. Não é simulador da Terra. Os dois cilindros do piloto têm mesma dimensão e valores de preenchimento emparelhados, mas o diagrama é qualitativo e o tubo não implementa contabilidade volumétrica.

## EnvironmentState e PresenterMode

visibility controla a geometria do ambiente, mantendo luz/background. tint multiplica as cores; fogIntensity modifica near/far; backgroundEmphasis escurece o fundo. groundCutaway abre uma janela no chão de LAB, explicitamente capability-gated; outros ambientes rejeitam esse modifier. Os demais não são obrigados a oferecer corte. Não há novo Environment ID.

PRESENTER/HYBRID mantêm o cast visível; DEMONSTRATION o oculta na mesma cena contínua, sem apagar estado. Foco/cobertura da câmera continuam autorados e validados pela Fase13. Não há auto-direção ou compilação automática de qualquer texto em fenômeno.

## Proof e budgets

VisualProof registra NONE/SYMBOLIC/PARTIAL/DIRECT com recurso/primitive/demonstração como evidência. `proofQa` valida cobertura, IDs de claim e presença de evidências; a adequação semântica é anotação autoral, não fact checking nem estética automática. Taxa DIRECT é condicionada ao conjunto de claims e denominador declarado.

Limites: 8 subjects, 32 steps, 8 pontos/path, 4 operações simultâneas, estimativa conservadora de 80 meshes demonstrativos, 12 placas de frost, zero partículas extras de fluxo. Caps legados de instâncias/VFX continuam. Estado, frames, operações, conflitos, transições, modifiers e valores finitos são verificados antes de render. O número de meshes é orçamento/estimativa local, não contador de draw calls GPU.

Os pilotos são silenciosos por decisão de isolamento; nenhum SFX, música, B-roll, pack ou API generativa foi integrado. Captions antigas continuam estimadas e inalteradas. O master de 81s não é atualizado automaticamente.
