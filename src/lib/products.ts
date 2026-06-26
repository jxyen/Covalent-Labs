export type Category =
  | "Recovery & Repair"
  | "Metabolic & Weight"
  | "Growth Hormone"
  | "Skin & Cosmetic"
  | "Blends & Stacks";

export type FilterCategory = "All" | Category;

export interface SizeOption {
  mg: string;
  price: number;
}

export interface Product {
  code: string;
  name: string;
  sub: string;
  category: Category;
  /** Transparent vial cutout (public/products/cutout/*.png) — sits on the emerald gradient. */
  image: string;
  /** Short mechanism/category label shown in the card pill. */
  mechanism: string;
  /** Punchy benefit headline for hero/feature cards. Use \n for the line break. */
  tagline: string;
  purity: string;
  sizes: SizeOption[];
  rating: number;
  reviews: number;
  bestseller: boolean;
  featured: boolean;
  blurb: string;
  /** Reference "buy separately" total for bundles — drives the savings callout. */
  compareAt?: number;
}

export const CATEGORIES: FilterCategory[] = [
  "All",
  "Recovery & Repair",
  "Metabolic & Weight",
  "Growth Hormone",
  "Skin & Cosmetic",
  "Blends & Stacks",
];

export interface CategoryMeta {
  name: Category;
  blurb: string;
}

export const CATEGORY_META: CategoryMeta[] = [
  { name: "Recovery & Repair", blurb: "Tissue repair, healing and regeneration research." },
  { name: "Metabolic & Weight", blurb: "Incretin, lipid and glucose-metabolism compounds." },
  { name: "Growth Hormone", blurb: "Secretagogues and GHRH analogs for GH-release studies." },
  { name: "Skin & Cosmetic", blurb: "Collagen, pigmentation and dermal-model compounds." },
  { name: "Blends & Stacks", blurb: "Co-formulated multi-peptide research stacks." },
];

export function categoryCount(list: Product[], category: Category): number {
  return list.filter((p) => p.category === category).length;
}

/* ---------- Price / size helpers ---------- */
export function fromPrice(p: Product): number {
  return Math.min(...p.sizes.map((s) => s.price));
}

export function formatUSD(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** "$42.99" for one size, "$42.99 – $69.99" for a range. */
export function priceDisplay(p: Product): string {
  const prices = p.sizes.map((s) => s.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? formatUSD(lo) : `${formatUSD(lo)} – ${formatUSD(hi)}`;
}

/** "5 mg" for one size, "2 sizes" when multiple dosages are offered. */
export function sizeDisplay(p: Product): string {
  return p.sizes.length === 1 ? p.sizes[0].mg : `${p.sizes.length} sizes`;
}

/* ---------- Slugs / lookup (for product detail pages) ---------- */
/** URL slug derived from the cutout filename, e.g. "/products/cutout/bpc-157.png" -> "bpc-157". */
export function productSlug(p: Product): string {
  return p.image.split("/").pop()!.replace(/\.png$/, "");
}
export function productHref(p: Product): string {
  return `/product/${productSlug(p)}`;
}
export function productBySlug(list: Product[], slug: string): Product | undefined {
  return list.find((p) => productSlug(p) === slug);
}

/* ---------- Per-product technical detail (for detail pages) ----------
   Identifiers below are standard published reference values for each
   compound. All copy is third-party / research-framed — no use claims. */
export interface ProductDetail {
  fullName: string;
  aliases?: string;
  cas?: string;
  formula?: string;
  molarMass?: string;
  sequence?: string;
  form: string;
  storage: string;
  /** Factual, third-person research context — what the molecule is and what it is studied for. */
  research: string;
  /** For blends: the co-formulated components. */
  components?: string[];
}

const STORAGE_LYO =
  "Store lyophilized powder at -20°C, protected from light. After reconstitution with bacteriostatic water, store at 2–8°C and use within ~4 weeks.";

export const PRODUCT_DETAILS: Record<string, ProductDetail> = {
  "BPC-157": {
    fullName: "BPC-157 (Body Protection Compound-157)",
    aliases: "PL 14736, Bepecin",
    cas: "137525-51-0",
    formula: "C62H98N16O22",
    molarMass: "≈ 1419.5 g/mol",
    sequence: "Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val",
    form: "Lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A synthetic 15-amino-acid peptide derived from a partial sequence of a protein found in gastric juice. Widely used in preclinical models studying angiogenesis and connective-tissue and gastrointestinal repair.",
  },
  "TB-500": {
    fullName: "TB-500 (Thymosin β4 / Tβ4)",
    aliases: "Thymosin Beta-4",
    cas: "77591-33-4",
    formula: "C212H350N56O78S",
    molarMass: "≈ 4963.4 g/mol",
    form: "Lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A synthetic peptide based on thymosin β4, an actin-binding regulatory peptide. Investigated in cell-migration, angiogenesis and tissue-regeneration research models.",
  },
  Tirzepatide: {
    fullName: "Tirzepatide",
    aliases: "LY3298176, GIP/GLP-1 RA",
    cas: "2023788-19-2",
    formula: "C225H348N48O68",
    molarMass: "≈ 4813.5 g/mol",
    form: "Lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A 39-amino-acid dual agonist of the GIP and GLP-1 receptors. Studied across glucose-metabolism, incretin-signaling and energy-balance research endpoints.",
  },
  Retatrutide: {
    fullName: "Retatrutide",
    aliases: "LY3437943, GGG tri-agonist",
    cas: "2381089-83-2",
    formula: "C221H342N46O68",
    molarMass: "≈ 4731.3 g/mol",
    form: "Lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "An investigational triple agonist of the GIP, GLP-1 and glucagon receptors. Studied in metabolic, glucose-regulation and body-weight research models.",
  },
  "MOTS-c": {
    fullName: "MOTS-c (Mitochondrial ORF of the 12S rRNA type-c)",
    cas: "1627580-64-6",
    formula: "C101H152N28O22S",
    molarMass: "≈ 2174.6 g/mol",
    sequence: "Met-Arg-Trp-Gln-Glu-Met-Gly-Tyr-Ile-Phe-Tyr-Pro-Arg-Lys-Leu-Arg",
    form: "Lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A 16-amino-acid mitochondrial-derived peptide. Investigated in research on cellular metabolism, AMPK signaling and metabolic homeostasis.",
  },
  "CJC-1295": {
    fullName: "CJC-1295 (without DAC) / Modified GRF (1-29)",
    aliases: "Mod GRF 1-29",
    cas: "863288-34-0",
    formula: "C152H252N44O42",
    molarMass: "≈ 3367.9 g/mol",
    form: "Lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A 29-amino-acid analog of growth-hormone-releasing hormone (GHRH). Used in research on growth-hormone secretion, frequently alongside a GH secretagogue.",
  },
  Ipamorelin: {
    fullName: "Ipamorelin",
    cas: "170851-70-4",
    formula: "C38H49N9O5",
    molarMass: "≈ 711.85 g/mol",
    sequence: "Aib-His-D-2-Nal-D-Phe-Lys-NH2",
    form: "Lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A selective pentapeptide agonist of the ghrelin/GH-secretagogue receptor (GHSR). Studied in growth-hormone-release research models.",
  },
  "IGF-1-LR3": {
    fullName: "IGF-1 LR3 (Long R3 Insulin-like Growth Factor-1)",
    aliases: "Long R3 IGF-1",
    cas: "946870-92-4",
    formula: "C400H625N111O115S9",
    molarMass: "≈ 9117.6 g/mol",
    form: "Lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "An 83-amino-acid analog of IGF-1 with extended half-life. Investigated in cellular-growth, proliferation and signaling research.",
  },
  "GHK-Cu": {
    fullName: "GHK-Cu (Copper Tripeptide-1)",
    aliases: "Copper Peptide GHK",
    cas: "49557-75-7",
    formula: "C14H24CuN6O4",
    molarMass: "≈ 403.9 g/mol",
    sequence: "Gly-His-Lys : Cu(II)",
    form: "Lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A naturally occurring copper-binding tripeptide complex. Investigated in skin, collagen-synthesis and dermal-model research.",
  },
  "MT-2": {
    fullName: "Melanotan II (MT-2)",
    aliases: "MT-II",
    cas: "121062-08-6",
    formula: "C50H69N15O9",
    molarMass: "≈ 1024.2 g/mol",
    form: "Lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A synthetic cyclic analog of α-melanocyte-stimulating hormone (α-MSH) and a non-selective melanocortin-receptor agonist. Studied in pigmentation research models.",
  },
  "BPC-TB-Blend": {
    fullName: "BPC-157 + TB-500 Recovery Blend",
    form: "Co-formulated lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A co-formulated research blend of BPC-157 and TB-500 (thymosin β4), studied together in tissue-repair and regeneration research models.",
    components: ["BPC-157 — CAS 137525-51-0, C62H98N16O22", "TB-500 (Thymosin β4) — CAS 77591-33-4, C212H350N56O78S"],
  },
  "CJC-Ipa-Blend": {
    fullName: "CJC-1295 (no DAC) + Ipamorelin GH Blend",
    form: "Co-formulated lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A co-formulated research blend of the GHRH analog CJC-1295 (no DAC) and the GH-secretagogue Ipamorelin, studied together in growth-hormone-release research.",
    components: ["CJC-1295 (no DAC) — CAS 863288-34-0, C152H252N44O42", "Ipamorelin — CAS 170851-70-4, C38H49N9O5"],
  },
  GLOW: {
    fullName: "GLOW Stack (GHK-Cu + TB-500 + BPC-157)",
    form: "Co-formulated lyophilized powder",
    storage: STORAGE_LYO,
    research:
      "A co-formulated research blend of GHK-Cu, TB-500 (thymosin β4) and BPC-157, studied together in skin, recovery and tissue-repair research models.",
    components: [
      "GHK-Cu — CAS 49557-75-7, C14H24CuN6O4",
      "TB-500 (Thymosin β4) — CAS 77591-33-4, C212H350N56O78S",
      "BPC-157 — CAS 137525-51-0, C62H98N16O22",
    ],
  },
};

export function productDetail(p: Product): ProductDetail | undefined {
  return PRODUCT_DETAILS[p.code];
}

/** A few related products to surface as "frequently bought together". */
export function relatedProducts(list: Product[], p: Product, n = 3): Product[] {
  return list.filter((x) => x.category === p.category && x.code !== p.code).slice(0, n);
}

/* ============================================================
   UPSELL / AOV — volume tiers, free shipping, value + bundle math
   ============================================================ */

/** Free US shipping above this order subtotal (USD). */
export const FREE_SHIP_THRESHOLD = 99;

/** "Buy more, save more" — fraction off by unit quantity. */
export const VOLUME_TIERS: { min: number; off: number }[] = [
  { min: 5, off: 0.2 },
  { min: 3, off: 0.15 },
  { min: 2, off: 0.1 },
];
export function volumeDiscount(qty: number): number {
  for (const t of VOLUME_TIERS) if (qty >= t.min) return t.off;
  return 0;
}

/** Numeric mg from a size label like "20 mg" -> 20. */
export function mgOf(s: SizeOption): number {
  const n = parseFloat(s.mg);
  return Number.isFinite(n) ? n : 0;
}
/** Price per mg for a size. */
export function perMg(s: SizeOption): number {
  const mg = mgOf(s);
  return mg > 0 ? s.price / mg : s.price;
}
/** Index of the lowest $/mg size (best value); -1 when only one size. */
export function bestValueSizeIndex(p: Product): number {
  if (p.sizes.length < 2) return -1;
  let bi = 0;
  let best = perMg(p.sizes[0]);
  p.sizes.forEach((s, i) => {
    const v = perMg(s);
    if (v < best) { best = v; bi = i; }
  });
  return bi;
}
/** % a size saves on a $/mg basis vs the priciest (smallest) size. */
export function sizeSavingsPct(p: Product, i: number): number {
  const worst = Math.max(...p.sizes.map(perMg));
  if (worst <= 0) return 0;
  return Math.round((1 - perMg(p.sizes[i]) / worst) * 100);
}

/** Bundle savings vs buying components separately (from compareAt). */
export function bundleSavings(p: Product): { compareAt: number; save: number; pct: number } | null {
  if (!p.compareAt) return null;
  const price = fromPrice(p);
  const save = p.compareAt - price;
  if (save <= 0) return null;
  return { compareAt: p.compareAt, save, pct: Math.round((save / p.compareAt) * 100) };
}

/* ---------- Accessories / consumables (high-attach add-ons) ---------- */
export type AccessoryIcon = "water" | "syringe" | "swab" | "vial";
export interface Accessory {
  code: string;
  name: string;
  sub: string;
  price: number;
  icon: AccessoryIcon;
}
export const ACCESSORIES: Accessory[] = [
  { code: "BAC-WATER", name: "Bacteriostatic Water", sub: "30 mL · for reconstitution", price: 11.99, icon: "water" },
  { code: "SYRINGES", name: "Insulin Syringes", sub: "0.5 mL · 31G · box of 10", price: 9.99, icon: "syringe" },
  { code: "SWABS", name: "Alcohol Prep Pads", sub: "Sterile · box of 100", price: 5.99, icon: "swab" },
  { code: "VIALS", name: "Sterile Empty Vials", sub: "10 mL · pack of 5", price: 12.99, icon: "vial" },
];
