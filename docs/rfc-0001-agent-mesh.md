# RFC 0001 — Agent mesh P2P: scopo, filtro e disegno funzionale

| | |
|---|---|
| Stato | Draft |
| Autore | Simone Gosetto |
| Data | 2026-09-03 |
| Repo | simonegosetto/p2p-eco |

## Sommario

Questo repo è nato per sincronizzare risorse arbitrarie su una rete P2P e si è fermato
per tre anni sul problema della risoluzione dei conflitti. Questo documento fissa: un
filtro per decidere dove il P2P ha senso; la direzione scelta, una mesh di agenti che si
trovano per chiave e non per URL; il disegno funzionale a strati; le correzioni emerse da
una revisione indipendente in modalità avvocato del diavolo; le alternative oneste; una
roadmap di dogfooding con un criterio di abbandono misurabile.

**Non impegna a costruire.** Un piano di implementazione di una prima fase è stato
proposto e rifiutato il 2026-09-03. Librerie e sintassi sono considerate sostituibili:
qui si decide lo scopo, non lo stack.

## 1. Decisioni registrate

1. Direzione: **agent mesh P2P**.
2. Primo utente: **Upthere stessa**, in dogfooding.
3. Situazione attuale: agenti e server MCP (Hana, Loonar, Workland) girano **su server
   Upthere**. Il caso "residency dei dati" oggi non esiste e andrebbe costruito.
4. Primo workflow candidato: **il laptop dello sviluppatore che espone capability locali
   ai colleghi** (repo sotto NDA, LLM locale, file), senza porte in ingresso e senza un
   server che veda i contenuti.

## 2. Contesto

Il repo nasce nel 2022, nel 2023 diventa un nodo P2P su `discovery-swarm` con
un'astrazione `Resource` che trasmette digest SHA-256, e si ferma a febbraio 2023 sulla
domanda "quale algoritmo di sincronizzazione" (issue #2, chiusa senza conclusione).

A settembre 2026 una passata di igiene ha sistemato framing dei messaggi, identità dei
peer, ciclo di vita del nodo, dipendenze, test, CI e build. Durante quel lavoro sono
emersi due fatti che pesano su qualunque direzione:

- `discovery-swarm` **non tiene su il link**: due peer sullo stesso canale si connettono
  e si chiudono circa una volta al secondo. Riprodotto con la libreria nuda, senza codice
  del progetto nel percorso. Il codice originale non avrebbe mai potuto scambiare dati.
- La catena di dipendenze di `discovery-swarm` porta **6 vulnerabilità high** (`dns-packet`,
  `ip`, `dns-socket`, `discovery-channel`), non risolvibili senza cambiare trasporto.

Il blocco vero però è architetturale: il modello ha solo `{name, values, hash}`. Un hash
**rileva** che due repliche divergono, ma non dice **quale sia più recente**. Senza
versione, clock logico o CRDT, qualunque algoritmo di sync è indecidibile con scritture
concorrenti.

## 3. Il filtro: dove il centro è il problema

Il P2P vince solo dove un server centrale non è inferiore ma **sbagliato**:

1. **Privacy o sovranità**: i dati non possono lasciare la macchina o l'azienda.
2. **Sopravvivenza**: il sistema deve funzionare proprio quando il centro cade.
3. **Località offline**: siti con connettività intermittente che devono continuare a lavorare.
4. **Fiducia**: il proprietario del centro è il soggetto da cui bisogna proteggersi.

Fuori da questi quattro casi un VPS vince sempre. È il motivo per cui la maggior parte dei
progetti P2P muore: risolvono un problema che un server risolve meglio.

## 4. Gli spunti valutati

**Calcolo distribuito.** In forma generica bocciato: il cloud costa meno, BOINC e Golem
esistono da vent'anni. Variante viva: pooling di inferenza LLM sull'hardware d'ufficio con
vincolo di privacy (filtro 1). Precedenti: exo, Petals. Il valore scoperto non è il motore
ma l'orchestrazione e la verifica dei risultati tra peer.

**Sharing.** File sharing bocciato, saturo. Variante viva: local-first di dati strutturati
multi-sede (filtro 3), cioè l'idea originaria. Postgres è il centro di quel mercato, MySQL
la periferia: gap reale, ma impegno da prodotto e ritorno dritto al blocco storico.

**Analisi di rete.** Come analisi dell'overlay è strumentazione, non scopo. Come
monitoraggio distribuito di raggiungibilità in cui ogni nodo osserva gli altri (filtro 2,
modello RIPE Atlas) è P2P-nativo, semplice e riusa quasi tutto: verticale ideale per fare
dogfooding di un substrato, non un progetto in sé.

| Direzione | Centro = problema? | Fit competenze | Primo utente | Affollamento | Nucleo difficile |
|---|---|---|---|---|---|
| Witnessing / attestation mesh | alto (4) | altissimo: notarizzazione, Merkle, firme | gruppo Elea | basso | firme e clock |
| Monitoraggio distribuito | alto (2) | medio | clienti multi-sede | medio | basso |
| RAG federato privato | alto (1) se cross-azienda | altissimo: LLM locale, privacy | Upthere e gruppo | emergente | ranking, nodi spenti |
| Pooling inferenza LLM | alto (1) | alto | Upthere | exo, Petals | sharding, già risolto altrove |
| Agent mesh P2P | medio-alto (4, B2B) | altissimo: LLM + blockchain + B2B | prodotti Upthere | emergente | identità e capability discovery |
| Local-first sync MySQL | alto (3) | alto: MySQL, clienti con cantieri | clienti | finanziato | conflitti: il blocco storico |
| Calcolo generico | basso | basso | nessuno | BOINC, Golem | scheduling e trust |
| File sharing | basso | basso | nessuno | saturo | nessuno |

## 5. Il ribaltamento: attestare, non sincronizzare

Il progetto si è fermato perché il problema era inquadrato come replica di database, che
richiede una primitiva di risoluzione dei conflitti. Ma trasmettere digest firmabili di uno
stato non è il primo passo di un protocollo di sync: **è il primo passo di un protocollo
di witnessing**. Se ogni nodo mette i propri digest in una catena personale firmata e i
peer li controfirmano, si ottiene una storia tamper-evident senza che nessuno debba
concordare con nessuno. La divergenza viene registrata, non risolta. Precedenti: Secure
Scuttlebutt (log firmati per identità replicati via gossip, nessun consenso globale) e
Hypercore. La Merkle root periodica può essere ancorata su Commercio.network.

È la competenza blockchain applicata al posto della competenza database che mancava. E
sopra un substrato di attestazione i verticali si impilano: prove di raggiungibilità
controfirmate, risultati di calcolo confrontati per hash, audit consortile tra aziende del
gruppo, e in coda la sync originaria con CRDT off-the-shelf su una base solida invece che
come base.

## 6. Direzione scelta: agent mesh P2P

### 6.1 Panorama verificato (settembre 2026)

| Protocollo | Stato | Cosa conta |
|---|---|---|
| **A2A v1.0** (mar 2026, Linux Foundation, 150+ org) | JSON-RPC, gRPC e REST come binding; il modello dati proto (`lf.a2a.v1`) è normativo e **indipendente dal trasporto** | Agent Card **già firmate** (JWS, JCS). Task con 8 stati. `AgentInterface.protocol_binding` è una stringa libera. Auth pensata per HTTP |
| **MCP 2026-07-28** | Protocollo **stateless** (via `Mcp-Session-Id`), OAuth 2.1 su HTTP, estensioni. Discovery via **registry centralizzati** | I server di prodotto sono MCP. Stateless significa che un tunnel su stream è un forwarder puro |
| **ANP** (W3C Community Group) | DID (`did:wba` ospitato su dominio HTTPS), meta-protocol layer, JSON-LD. Trasporto HTTPS, endpoint pubblici richiesti, nessun SDK di produzione | Idea giusta, trasporto sbagliato per noi: si prende il principio, non lo stack |
| **NANDA** (MIT) | AgentFacts + "Registry Quilt", federazione di registri | Ancora registri, non discovery P2P |
| **AGNTCY/SLIM** (Cisco, draft IETF `draft-mpsb-agntcy-slim-02`, lug 2026) | gRPC su HTTP/2, E2E con MLS (RFC 9420), identità gerarchica per chiave, SDK anche JS. **Richiede nodi Data Plane e un Controller** | Conferma "protocollo sopra, trasporto sotto". Overlay instradato, non brokerless: i suoi nodi sono esattamente il centro |
| **iroh 1.0** (giu 2026, n0) | `NodeId` = chiave pubblica Ed25519, QUIC + TLS 1.3 E2E, hole punching con relay cifrati di fallback self-hostabili, discovery DNS / DHT / mDNS, protocolli custom via ALPN. Binding Node.js `@number0/iroh` 1.1.0. I binding JS **non** espongono gossip | Risolve il trasporto: identità nella connessione, NAT, cifratura. Tutto il valore proprio sta sopra |

**Posizionamento**: poiché il modello dati A2A è indipendente dal trasporto, "A2A su
stream P2P" è un **quarto binding legittimo**, non un protocollo concorrente. La mesh non
inventa un modello di task: aggiunge un binding per gli ambienti in cui un endpoint HTTPS
è sbagliato. Per MCP: tunnel, non reimplementazione. **A2A è la lingua, la mesh è la strada.**

### 6.2 Il concetto

> Agenti che si trovano per chiave, non per URL. Ogni agente o tool server è una coppia di
> chiavi; le capability sono card firmate; le richieste sono task A2A o chiamate MCP su
> stream cifrati; ogni interazione lascia una ricevuta firmata e controfirmata.

### 6.3 Strati

**L0 Trasporto (si compra, non si costruisce).** Requisiti: identità = chiave pubblica,
stream bidirezionali cifrati end-to-end, NAT traversal. Default iroh con relay self-hosted.
**Vincolo: L1–L4 non devono conoscere L0.** Prova del vincolo: gli stessi strati devono
funzionare su HTTPS dentro una tailnet. Se non ci funzionano, il disegno è sbagliato.

**L1 Identità e fiducia.** Identità dell'agente = chiave del nodo. Identità
dell'organizzazione = chiave org che certifica le chiavi agente con scadenza breve
(≤ 30 giorni). Trust anchor locali curati a mano. Rotazione = nuovo certificato; revoca =
scadenza breve.

**L2 Discovery per capability, senza registry a runtime.** Fonte di verità: un **roster
firmato** dalla chiave org, distribuito fuori banda (repo git, URL well-known, mDNS), le
cui entry sono Agent Card A2A firmate con `supportedInterfaces: [{url: "iroh:<id>",
protocolBinding: "JSONRPC"}]`. Una capability è credibile solo se nel roster: elimina
squatting, entry stantie e dipendenza dalla DHT. La presenza ("chi è online") si scopre
dialando: con una decina di nodi è irrilevante.

**L3 Interazione.** Binding A2A su stream per i task; tunnel MCP per i tool. Autenticazione
fatta dal trasporto (l'id remoto è verificato in TLS). Ogni richiesta porta idempotency
key, timestamp e nonce; dedup per `(peer, key)`; **solo tool read-only o idempotenti nella
prima fase**; per le scritture timeout duro e at-most-once, mai retry silenzioso.
Autorizzazione con policy locale deny-by-default.

**L4 Accountability.** Ogni richiesta e risposta produce una ricevuta `{hash richiesta,
hash risposta, mittente, destinatario, ts, hash precedente, firma}` appesa alla catena
personale del nodo; la controparte controfirma. Merkle root periodica, opzionalmente
ancorata su Commercio.network. Risposta tamper-evident a "quale agente ha chiesto cosa a
chi, quando, e cosa ha ottenuto", senza server di log centrale. Le firme applicative
servono alla non ripudiabilità, non all'autenticazione.

### 6.4 Cosa sopravvive del codice attuale

| Oggi | In una mesh |
|---|---|
| framing length-prefix | framing dei messaggi A2A/MCP sugli stream lunghi |
| lifecycle del nodo (`ready`, `destroy`, registro peer) | wrapper dell'endpoint, stessa forma |
| config, logger, test `node:test`, CI, rspack | invariati |
| `Resource` e `ResourceManager` (sync di stato) | **ritirati**: fuori dal nucleo |
| `discovery-swarm`, `dat-swarm-defaults` | **eliminati**: flapping e CVE |

## 7. Correzioni dalla revisione indipendente

Il disegno è stato sottoposto a una revisione con il mandato di demolirlo.

**Accolto.**
1. Per il dogfooding interno **nessuno dei quattro filtri regge**: i dati stanno già su
   server Upthere. Il dogfooding è un banco di prova, giustificato solo dal north star
   (agenti presso clienti on-prem, cross-company nel gruppo). Va detto così.
2. **La sync di stato resta fuori, non riciclata**: due agenti sullo stesso task sono lo
   stesso conflitto dei tre anni persi, spostato dai dati alle azioni. Il pattern digest
   sopravvive solo per documenti single-writer (la card di un nodo, la testa della sua
   catena), che per costruzione non hanno conflitti.
3. **Roster firmato come verità, gossip solo per la presenza.**
4. **Idempotenza obbligatoria** e solo tool read-only nella prima fase.
5. **Primo workflow: il laptop dello sviluppatore**, l'unico disponibile oggi in cui il
   centro è sbagliato e non solo scomodo. Seconda tappa: agente on-prem presso un cliente
   che restituisce solo aggregati firmati.
6. **Verifica dei risultati irrisolvibile senza TEE**: ci si fida del firmatario.
7. **Prematuro**: DID e verifiable credentials, identità on-chain, catene di delega,
   policy engine, exactly-once, store-and-forward, multi-hop, DHT, matching semantico,
   reputazione.

**Respinto, con motivo.** "MCP nudo sulla mesh è scomodo sotto churn per la sessione
inizializzata": vero fino a giugno, la spec 2026-07-28 ha tolto la sessione dal protocollo.
Il punto vero dietro l'obiezione, la superficie di sicurezza, si accoglie con roster e
policy che decidono quali tool sono esposti. "Il relay è un server rientrato dalla
finestra": vede solo cifrato, serve solo quando l'hole punching fallisce, ed è coperto dal
criterio di abbandono.

**Disegno aggiornato in tre righe.** Identità nodo Ed25519 con certificato org a scadenza
breve · roster firmato fuori banda e presenza per dialing · payload A2A invariato per i
task e MCP stateless in tunnel per i tool, con idempotency key e nonce · log locale
append-only di ricevute controfirmate con Merkle root notarizzata. Trasporto: qualunque
cosa dia identità per chiave, stream cifrati E2E e NAT traversal.

## 8. Alternative oneste

- **Tailscale/WireGuard + A2A/MCP su HTTPS**: identità per chiave e NAT traversal senza
  scrivere una riga. Non dà discovery per capability senza registry, ricevute applicative,
  fiducia cross-org senza un amministratore di rete condiviso, identità per agente invece
  che per macchina. **Il prodotto è L1–L4**; L0 è intercambiabile e questa variante ne è
  la prova.
- **AGNTCY/SLIM + A2A**: E2E con MLS e identità org di serie, ma richiede nodi di routing e
  un Controller: è il centro. Copre il caso "adotta e fermati" quando la condizione
  "centro sbagliato" non è stretta.
- **ANP, NANDA**: HTTPS ed endpoint pubblici, o registri federati. Si prende l'idea
  (identificatore = chiave pubblica), non lo stack.

La mesh ha un posto solo per la residency dei dati e per il brokerless vero.

## 9. Roadmap di dogfooding e criterio di abbandono

Ordine, non date.

- **A. Un salto.** Due laptop, roster firmato, tunnel MCP di tre tool read-only locali;
  un client MCP sul secondo laptop li vede come locali. Nessuna porta aperta.
- **B. Binding A2A.** Un agente sottomette un task A2A a un altro, stati in streaming.
- **C. Ricevute.** Witnessing su ogni chiamata, verifica della catena, ancoraggio Merkle.
- **D. Seconda organizzazione.** Chiave org di un'azienda del gruppo come secondo trust
  anchor: prima chiamata cross-company. È il north star.

**Criterio di abbandono a 4–6 settimane**, si abbandona se vale anche uno solo:
(i) più del 10% delle sessioni passa dal relay: c'è già un server, si usi HTTP;
(ii) nessun workflow reale ha toccato dati che non potevano transitare da un server
Upthere: la mesh è un hobby; (iii) più di metà del tempo di debug va in connettività e
identità invece che in comportamento degli agenti; (iv) i colleghi continuano ad aprire i
server MCP direttamente perché è più facile. **Criterio di sopravvivenza**: almeno un
collega la usa ogni settimana senza sollecito. In caso di abbandono, L1, L2 e L4 restano
validi anche su HTTPS.

## 10. Rischi e decisioni aperte

- Dipendenza da un trasporto in Rust (iroh): mitigata da L0 sostituibile per costruzione.
- Churn di A2A e MCP: mitigato portandoli come payload, non rispecificandoli.
- Auditabilità: un overlay P2P è più difficile da recensire di un gateway HTTP.
  Deny-by-default e certificati org dal giorno uno; le ricevute aiutano la forensica, non
  la prevenzione.
- Discovery pubblica del trasporto: rivela l'esistenza di un id su DNS pubblico; dati
  cifrati E2E, ma va detto; self-hosting di relay e discovery in una fase successiva.
- Convenzione esatta del payload detached nelle firme A2A: da pinnare sulla spec al
  momento dell'implementazione.
- **Aperto**: se, quando e con quale perimetro costruire la fase A.

## 11. Fonti

- A2A Protocol Specification: https://a2a-protocol.org/latest/specification/
- A2A repository, `specification/a2a.proto`: https://github.com/a2aproject/A2A
- Agent2Agent, Wikipedia: https://en.wikipedia.org/wiki/Agent2Agent
- MCP 2026-07-28 release: https://blog.modelcontextprotocol.io/posts/2026-07-28/
- MCP specification 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28
- MCP Registry preview: https://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/
- Agent Network Protocol, W3C CG: https://w3c-cg.github.io/ai-agent-protocol/
- MIT Project NANDA, The New Stack: https://thenewstack.io/how-mits-project-nanda-aims-to-decentralize-ai-agents/
- Survey of agent interoperability protocols (MCP, ACP, A2A, ANP): https://arxiv.org/html/2505.02279v1
- Security threat modeling of MCP, A2A, Agora, ANP: https://arxiv.org/pdf/2602.11327
- iroh, what is iroh: https://docs.iroh.computer/what-is-iroh
- iroh JavaScript bindings: https://docs.iroh.computer/languages/javascript
- iroh-ffi repository: https://github.com/n0-computer/iroh-ffi
- `@number0/iroh` su npm: https://www.npmjs.com/package/@number0/iroh
- iroh 1.0, "Dial keys, not IPs": https://pinggy.io/blog/iroh_1_0_dial_keys_not_ips/
- SLIM overview: https://slim.agntcy.org/latest/slim/slim-overview/
- IETF draft-mpsb-agntcy-slim: https://datatracker.ietf.org/doc/draft-mpsb-agntcy-slim/
- Linux Foundation welcomes AGNTCY: https://www.linuxfoundation.org/press/linux-foundation-welcomes-the-agntcy-project-to-standardize-open-multi-agent-system-infrastructure-and-break-down-ai-agent-silos
- `@modelcontextprotocol/sdk` su npm: https://www.npmjs.com/package/@modelcontextprotocol/sdk
