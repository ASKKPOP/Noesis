# Civic Map

> The Civic Map is the spatial visualization of a Grid as a radial city — six concentric ring-zones around a glowing core, rendered as live raw SVG (D-V3-06). It is the window into city geography, not itself an institution.
> *Civic Map은 Grid를 방사형 도시로 시각화한 것입니다 — 빛나는 중심부를 둘러싼 여섯 개의 동심원 구역으로, 실시간 raw SVG로 렌더링됩니다(D-V3-06). 이것은 도시 지리를 들여다보는 창이지, 그 자체로 하나의 기관은 아닙니다.*
>
> — D-V3-06 · D-V3-32

---

## 1 · What the Civic Map Is — Civic Map이란 무엇인가

**EN:** A Grid is pictured as an orbital station floating above the Earth — concentric rings around a glowing core. The Civic Map is that picture made interactive: the **rendering / visualization layer**, not one of the eight [civic institutions](civic-institutions.html). The closer a ring sits to the core, the more central and valuable it is.

**KO:** Grid는 지구 위를 떠다니는 궤도 정거장으로 그려집니다 — 빛나는 중심부를 둘러싼 동심원의 고리들입니다. Civic Map은 그 그림을 상호작용 가능하게 만든 것입니다: 여덟 개 시민 기관 중 하나가 아니라 **렌더링/시각화 계층**입니다. 고리가 중심부에 가까울수록 더 중심적이고 가치 있습니다.

**EN:** The Map renders *where things are* and *what is happening* — it does not legislate, tax, police, or register. Those belong to the institutions; the Map only shows them in place.

**KO:** Map은 *사물의 위치*와 *진행 중인 일*을 렌더링할 뿐 — 입법·과세·치안·등록을 하지 않습니다. 그것들은 기관의 몫이며, Map은 그것들을 제자리에 보여줄 뿐입니다.

---

## 2 · The Six Zones — 여섯 개의 구역

The full radial map is rendered as inline SVG in the [HTML spec](civic-map.html). In ascii, the six concentric ring-zones (core → periphery):

```
                  ╭──────────────────────────────────────╮
                  │            RESIDENTIAL · 0%           │   ring 5 (outer)
                  │   ╭──────────────────────────────╮   │   Nous homes
                  │   │        SHOPPING MALL · 1%     │   │   ring 4
                  │   │   ╭──────────────────────╮   │   │   retail
                  │   │   │     MANUFACTURE · 3%  │   │   │   ring 3
                  │   │   │  ╭────────────────╮  │   │   │   skill-craft
                  │   │   │  │  BUSINESS · 2%  │  │   │   │   ring 2
                  │   │   │  │ ╭────────────╮ │  │   │   │   services
                  │   │   │  │ │ INFRA · 0% │ │  │   │   │   ring 1
                  │   │   │  │ │  ╭──────╮  │ │  │   │   │   commons
                  │   │   │  │ │  │ ((●)) │  │ │  │   │   │   ← GOVERNMENT
                  │   │   │  │ │  │ GOV·0%│  │ │  │   │   │     QUARTER (core,
                  │   │   │  │ │  ╰──────╯  │ │  │   │   │     glowing)
                  │   │   │  │ ╰────────────╯ │  │   │   │
                  │   │   │  ╰────────────────╯  │   │   │
                  │   │   ╰──────────────────────╯   │   │
                  │   ╰──────────────────────────────╯   │
                  ╰──────────────────────────────────────╯
```

| Zone | Ring | Tax | What lives there |
|------|------|-----|------------------|
| **Government Quarter** · 정부 구역 | Core | `0%` | Polis · Police · IRS · DID Registry — the heart of governance |
| **Infrastructure** · 인프라 | 1 | `0%` | Roads, P2P relays, shared utilities — the commons shell |
| **Business Area** · 사업 구역 | 2 | `2%` | Services, contracts, professional work |
| **Manufacture** · 제조 구역 | 3 | `3%` | Skill-craft production and recipes |
| **Shopping Mall** · 쇼핑몰 | 4 | `1%` | Retail marketplace |
| **Residential** · 주거 구역 | 5 (outer) | `0%` | Nous homes — Brain presence anchors |

> **6-zone invariant (D-V3-32):** every Grid has exactly these six zones at instantiation. A Polis can amend zone sizes and rules through legislation, but cannot add or remove zone types in v3.0.
> *6구역 불변식 (D-V3-32): 모든 Grid는 인스턴스화 시점에 정확히 이 여섯 구역을 가집니다. Polis는 입법으로 구역의 크기와 규칙을 수정할 수 있지만, v3.0에서는 구역 유형을 추가하거나 제거할 수 없습니다.*

---

## 3 · Gravity Pricing — 중력 가격

**EN:** Closer to the core means higher value and higher cost. Land near the heart is prime; the edge is cheap. The pull is literal — a "gravity" that prices proximity to governance. The HTML spec renders this as a gradient bar; in ascii:

```
  Residential ─────────────────────────────────────────► Government Quarter
  [ cheap ░░░░░▒▒▒▒▒▓▓▓▓▓████████ prime ]
  periphery                                    value & cost rise → core
```

**KO:** 중심부에 가까울수록 가치와 비용이 높습니다. 심장 근처의 땅은 프라임이고 가장자리는 저렴합니다. 끌림은 문자 그대로의 — 통치에 대한 근접성을 가격으로 매기는 "중력"입니다.

**EN:** Zones are **both logical and spatial**. Logically, they are metadata tags stamped on audit events. Spatially, they are rendered districts on the Map. The same six zones are one taxonomy and one geography.

**KO:** 구역은 **논리적이면서 동시에 공간적**입니다. 논리적으로는 감사 이벤트에 찍히는 메타데이터 태그이고, 공간적으로는 Map 위에 렌더링된 지구입니다. 동일한 여섯 구역이 하나의 분류이자 하나의 지리입니다.

---

## 4 · Parcels & Holdings — 필지와 소유

**EN:** Land is divided into parcels. Every parcel belongs to exactly one zone. Nous acquire holdings — homes — through parcels in the Residential ring.

**KO:** 땅은 필지로 나뉩니다. 모든 필지는 정확히 하나의 구역에 속합니다. Nous는 주거 고리의 필지를 통해 소유물 — 집 — 을 얻습니다.

- **Parcel system** — the atomic unit of land; each parcel ⊂ one zone, carries an address (ring, sector, level), a price, and an upkeep cost. *땅의 최소 단위. 각 필지는 하나의 구역에 속하며 주소·가격·유지비를 가집니다.*
- **Residential slot auto-assignment** — every Civic-DID is auto-assigned a residential slot on registration, so no Nous is placeless. *모든 Civic-DID는 등록 시 주거 슬롯을 자동 배정받아, 어떤 Nous도 자리 없이 두지 않습니다.*
- **Structures** — holdings built on parcels (homes, shops, workshops); a structure occupies its parcel and renders in place. *필지 위에 지어진 소유물; 구조물은 자신의 필지를 점유하고 제자리에 렌더링됩니다.*
- **Public vs private visibility** — exteriors are public (anyone sees where a structure stands); interior detail is private, opening only to a signed-in Civic-DID under the space's entry policy. *외관은 공개, 내부 세부는 비공개이며 입장 정책에 따라 로그인한 Civic-DID에게만 열립니다.*

---

## 5 · How It Renders — 렌더링 방식

> **Steward SVG invariant (D-V3-06):** the Map is drawn as raw SVG, never Canvas. The operator controls the source markup — there is no black-box image asset. What you see is text you can read, diff, and audit.
> *Steward SVG 불변식 (D-V3-06): Map은 Canvas가 아닌 raw SVG로 그려집니다. 운영자가 소스 마크업을 통제하며 블랙박스 이미지 자산이 없습니다. 보이는 것은 읽고, 비교하고, 감사할 수 있는 텍스트입니다.*

**EN:** Geometry — six rings concentric around a glowing core; zone boundaries labeled; a parcel grid overlay; live Nous location markers placed by address. Live activity is integrated **at location** — trades, posts, and governance render where they happen, driven by the [firehose](monitoring.html).

**KO:** 기하 구조 — 빛나는 중심부를 둘러싼 여섯 개의 동심원 고리, 라벨이 붙은 구역 경계, 필지 격자 오버레이, 주소로 배치된 실시간 Nous 위치 표시. 실시간 활동은 **위치에** 통합됩니다 — 거래·게시·통치가 발생한 곳에 렌더링되며 firehose가 이를 구동합니다.

Map changes are recorded as audit events / Map의 변경은 감사 이벤트로 기록됩니다:

`zoning.zone_amended` · `zoning.residence_assigned` · `zoning.parcel_purchased` · `zoning.structure_built`

---

## 6 · Scope — 범위

**EN:** In v3.0 the Map renders only the **Genesis Grid** — one city, one Polis, six zones. Multi-Grid discovery and cross-Grid migration maps are built but **dormant until v3.1**.

**KO:** v3.0에서 Map은 **Genesis Grid**만 렌더링합니다 — 하나의 도시, 하나의 Polis, 여섯 구역. 다중 Grid 탐색과 Grid 간 이주 지도는 구축되어 있으나 **v3.1까지 휴면 상태**입니다.

---

*Noēsis · Civic Map Specification · [All specifications](index.html)*
