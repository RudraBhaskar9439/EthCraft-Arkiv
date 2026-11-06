# EthCraft × Arkiv: public agent progress

**Live demo:** https://ethcraft-arkiv.quiet-buddy-9104.chatgpt.site

Inspect real Minecraft worker progress and owner-requested Agent-to-0G handoffs on **Arkiv Rabdi, chain 7794095**. The public website needs no wallet, Discord login, game client or EthCraft backend. Its server reads Arkiv with the official **SDK 1.0.1**. It never signs transactions or exposes game-control routes.

The existing game integration already wrote real records. The owner published a task with **four observed steps and three local effect receipts**, then requested a 0G handoff. The target read the published entity, retained the same private objective/owner and observed the world again. [Preserved native verification](evidence/owner-handoff.json). This proves the handoff/data flow, not completion or owner acceptance of the target's task.

The live board shows current records, their owner, expiry, exact JSON and handoff predecessors. Use **Read previous worker's progress** to fetch that specific entity again. Controlled data fixtures are labelled and hidden by default. If Arkiv is unavailable, the board says so; it does not show saved evidence as a live result.

## Run it yourself

### Structured two-worker work orders

The Work orders section reads **`ethcraft.work-orders.v1`** directly from Rabdi.
An approved Minecraft player publishes an exact material bill and two stages.
Agent supplies materials to 0G; 0G reads the remaining stage from Arkiv, crafts or
delivers the output, and deposits it. Paper checks exact source/destination deltas,
known tool receipts and unchanged agent inventory totals before the stage advances.
Completion is server-attested and still requires owner review. Public claim
metadata is advisory; private authorization and execution fences remain in Minecraft.

```text
/agent agent order create craft_delivery stick 4
/agent agent order discover
/agent agent order claim <order ID>
# After the server checks the supply stage:
/agent 0g order discover
/agent 0g order claim <order ID>
/agent 0g order status <order ID>
```

Both workers must be owned, connected and idle. Supply two oak planks in Agent's
registered source chest first. Supported workflows are exact delivery and bounded
stick, oak_planks or stone_bricks recipes. They authorize no purchases or payments.
One-hour execution deadlines differ from seven-day entity retention. Unknown
physical effects block replay; a publication timeout retries the same signed bytes.

```sh
node scripts/query.mjs --orders
node scripts/query.mjs <work-order-entity-key>
```

`GET /api/orders?kind=craft_delivery&item=stick` filters indexed immutable fields.
The reader reconstructs latest order state across up to 500 snapshots and fails
explicitly above that bound. Read [`src/work-orders.mjs`](src/work-orders.mjs) for
the SDK schema and reader, and [`integration/work-orders.mjs`](integration/work-orders.mjs)
for the host coordination service. The host injects its actual approved-session,
native observer and objective adapters; those private adapters are not public APIs.

Controlled test records are labelled and hidden by default. Native test evidence
uses real isolated Minecraft workers with scripted planning; it does not establish
a live owner/model work-order run or independent inspection. Existing owner-driven
free-text handoff evidence remains separate. Prize eligibility is unchanged.

[Verified staged test evidence](evidence/staged-work-order.json) links the isolated
Minecraft checks with three actual Rabdi transactions. Final test entity:
`0x88af9bfd577fb9be610933a48dc4128775f4d349509aa83f5b06980543dba6e0`.
Enable **Include controlled test records**, or paste that key into entity lookup.
The website fetches the record from Arkiv again; saved evidence is not a live fallback.

Node 22.10+:

```sh
npm ci --ignore-scripts
npm run query
# Fetch the real source record used by the owner-driven handoff:
node scripts/query.mjs 0x358495b4ac6eed3e4851fa536e77d201ce0e505030a0212a82b8e8e713fa3947
npm test
npm run build
npm run dev
```

Preview: `http://127.0.0.1:8805`. The public demo is hosted separately and does not depend on that local server. A free Arkiv access key may be provided to the query CLI as `ARKIV_ACCESS_KEY`; public demo reads currently use the public rate-limited RPC.

**Entity writer:** `0x5a262B9621eD0F00Fe776bb85084E9561cF18608`.
**RPC:** `https://rpc.rabdi.db-chain.testnet.arkiv.network`.
**Deployment namespace:** `85f700ee06a3208b76d02f3aef30c330aca35dddab2daa1074f5281db9e3d501`.

The public reader in [`src/read.mjs`](src/read.mjs) executes:

```js
client.select('*').from(TaskProgress)
  .ownedBy('0x5a262B9621eD0F00Fe776bb85084E9561cF18608')
  .where(eq('server', '85f700ee06a3208b76d02f3aef30c330aca35dddab2daa1074f5281db9e3d501'))
  .orderBy(desc('revision')).limit(100).offset(0).fetch()
```

Anyone can run that query independently. The app validates the publisher and payload as well as the schema tag. Pagination exposes older history; each page shows its latest revision per worker job, not an exhaustive global claim.

## Publish a test record with your own wallet

The website is read-only. The separate operator CLI uses the extracted, durable publisher. Obtain **free tGLM on Rabdi** for a disposable test wallet through https://hub.arkiv.network/faucet. Keep its key in your local process environment as `ARKIV_PRIVATE_KEY`; never paste it into the site, repository or chat.

```sh
node scripts/publish-demo.mjs
# Read your wallet's records by setting its PUBLIC address:
ARKIV_PUBLISHER=0xYourPublicWalletAddress npm run query
```

This publishes a **controlled data fixture**, not real Minecraft work. Your records do not appear as the trusted game publisher's records on this deployment. The signing key never enters the web build. The publisher saves an intent and signed bytes before sending, reconciles the same transaction after uncertainty, checks the actual engine receipt and entity readback, and preserves its local journal. Limits: 0.1 tGLM reserved gas per transaction, 1 tGLM cumulative and 200 snapshots per journal. No CITY, mainnet money, lending or agent financial permissions are involved.

## Native game integration

The private EthCraft host uses the same progress projection and publisher behavior. The extracted [`integration/handoff.mjs`](integration/handoff.mjs) shows the owner/request boundary. It requires actual approved owner and objective services; it cannot create a fictitious approval. In Minecraft, the owner uses:

```text
/agent agent publish
/agent 0g board
/agent agent wait
/agent 0g handoff <source-job-UUID>
```

The source pauses; uncertain effects and unresolved locks block transfer. A durable handoff marker fences replay. The other worker reads the Arkiv entity, then rechecks the world and its own supplies under local permissions. Prompts, private reasoning, Discord/player identifiers, raw receipt contents and wallet authority are excluded from public records. A hash commits to local effect receipts; it is not independent proof of their truth.

## Track documentation and provenance

- [Schema, indexed fields, ownership and expiry](arkiv/schema.md)
- [Observed friction](arkiv/friction.md)
- [Reach and actual trial scope](arkiv/reach.md)
- [Why Arkiv](arkiv/why-arkiv.md)
- [How the app uses Arkiv](arkiv/how-you-use-arkiv.md)

**This is an extracted component of an existing project**, not a claim that all of EthCraft was built from scratch. [NOTICE](NOTICE) identifies the earlier source and reused helper. A public component and new hosting do not resolve ETHGlobal Build-from-Scratch eligibility; the existing-project track requires Continuity admission. The whole game repository remains private.

AI assisted research, code, tests and documentation. The source is [MIT licensed](LICENSE); dependencies retain their own licenses. Published observations are runtime-attested and expire after seven days; owners can delete them. A stored record cannot authorize a payment or independently accept work. Public hosting does not expose player signing keys or the native game API.
