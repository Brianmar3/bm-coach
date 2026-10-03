import type { ReactNode } from "react";

export type BodyMapView = "front" | "back";

type Zone = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms" | "core" | "glutes" | "quad" | "hamstring" | "adductors" | "calves";
type FigureProps = { view: BodyMapView; zoneColor: (zone: Zone) => string; zoneSeries: (zone: Zone) => number };

const zoneNames: Record<Zone, string> = {
  chest: "Pecho", back: "Espalda", shoulders: "Hombros", biceps: "Bíceps", triceps: "Tríceps",
  forearms: "Antebrazos", core: "Core", glutes: "Glúteos", quad: "Cuádriceps",
  hamstring: "Isquios", adductors: "Aductores", calves: "Gemelos",
};

function Region({ zone, d, side, zoneColor, zoneSeries }: { zone: Zone; d: string; side?: "left" | "right"; zoneColor: FigureProps["zoneColor"]; zoneSeries: FigureProps["zoneSeries"] }) {
  const series = zoneSeries(zone);
  return <path
    data-zone={zone}
    d={d}
    transform={side === "right" ? "translate(320 0) scale(-1 1)" : undefined}
    fill={zoneColor(zone)}
    fillOpacity={series ? 0.94 : 0.74}
    stroke={series ? "#f5d67c" : "#987b40"}
    strokeOpacity={series ? 0.94 : 0.72}
    strokeWidth="1.45"
    strokeLinejoin="round"
    className="transition-[fill,stroke] duration-300"
  ><title>{`${zoneNames[zone]}: ${series} ${series === 1 ? "serie" : "series"}`}</title></path>;
}

function Pair({ zone, d, zoneColor, zoneSeries }: { zone: Zone; d: string; zoneColor: FigureProps["zoneColor"]; zoneSeries: FigureProps["zoneSeries"] }) {
  return <><Region zone={zone} d={d} side="left" zoneColor={zoneColor} zoneSeries={zoneSeries} /><Region zone={zone} d={d} side="right" zoneColor={zoneColor} zoneSeries={zoneSeries} /></>;
}

function Frame({ view, children }: { view: BodyMapView; children: ReactNode }) {
  return <svg viewBox="0 0 320 620" preserveAspectRatio="xMidYMid meet" role="img" aria-label={view === "front" ? "Mapa corporal, vista anterior" : "Mapa corporal, vista posterior"} className="h-full w-full drop-shadow-[0_0_18px_rgba(188,141,43,0.13)]">
    <defs>
      <linearGradient id="bodyFrame" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#272727" /><stop offset="0.55" stopColor="#171717" /><stop offset="1" stopColor="#111111" /></linearGradient>
      <linearGradient id="bodyOutline" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d1a64c" /><stop offset="1" stopColor="#775b29" /></linearGradient>
    </defs>
    <g fill="url(#bodyFrame)" stroke="url(#bodyOutline)" strokeWidth="1.8" strokeLinejoin="round">
      {/* Head and neck are anatomical silhouettes, not circles or blocks. */}
      <path d="M160 17 C141 17 131 27 128 45 C125 59 130 78 137 89 C145 100 153 105 160 105 C167 105 175 100 183 89 C190 78 195 59 192 45 C189 27 179 17 160 17 Z" />
      <path d="M132 59 C125 53 123 66 130 76 M188 59 C195 53 197 66 190 76" fill="none" />
      <path d="M141 94 C144 110 139 118 126 124 L160 148 L194 124 C181 118 176 110 179 94" />
      {/* Torso, separated arms and legs create the underlying full-body outline. */}
      <path d="M126 121 C113 126 102 130 94 136 C101 158 104 184 111 205 C119 224 123 253 126 277 C128 299 120 319 111 340 Q135 354 160 349 Q185 354 209 340 C200 319 192 299 194 277 C197 253 201 224 209 205 C216 184 219 158 226 136 C218 130 207 126 194 121 Q178 135 160 139 Q142 135 126 121 Z" />
      <path d="M96 137 C75 137 64 154 63 180 C61 203 66 225 71 246 C68 265 56 291 51 319 C47 344 46 372 43 385 C39 398 42 411 48 425 C52 437 61 446 68 449 C72 451 74 447 71 443 L61 428 C59 423 59 414 62 409 C65 405 67 412 70 421 C74 426 79 425 80 419 C80 405 72 391 67 383 C69 360 80 333 88 310 C97 286 98 262 94 244 C102 223 111 198 113 178 C115 155 108 143 96 137 Z" />
      <path d="M224 137 C245 137 256 154 257 180 C259 203 254 225 249 246 C252 265 264 291 269 319 C273 344 274 372 277 385 C281 398 278 411 272 425 C268 437 259 446 252 449 C248 451 246 447 249 443 L259 428 C261 423 261 414 258 409 C255 405 253 412 250 421 C246 426 241 425 240 419 C240 405 248 391 253 383 C251 360 240 333 232 310 C223 286 222 262 226 244 C218 223 209 198 207 178 C205 155 212 143 224 137 Z" />
      <path d="M112 338 C102 364 102 389 105 421 C108 450 111 466 116 479 C115 506 109 535 113 557 C116 574 112 583 105 591 C98 599 97 606 110 609 C124 612 143 609 147 604 C149 600 145 592 140 585 C141 573 145 563 146 550 C149 518 151 493 151 474 C153 448 157 425 158 396 L160 350 Z" />
      <path d="M208 338 C218 364 218 389 215 421 C212 450 209 466 204 479 C205 506 211 535 207 557 C204 574 208 583 215 591 C222 599 223 606 210 609 C196 612 177 609 173 604 C171 600 175 592 180 585 C179 573 175 563 174 550 C171 518 169 493 169 474 C167 448 163 425 162 396 L160 350 Z" />
    </g>
    {children}
    <g fill="none" stroke="#dfc078" strokeOpacity="0.22" strokeWidth="1.2" strokeLinecap="round">
      <path d="M160 149 L160 324" />
      <path d="M113 479 Q130 485 148 476 M172 476 Q190 485 207 479" />
      {view === "front" ? <><path d="M127 220 Q160 227 193 220 M130 253 Q160 259 190 253 M134 284 Q160 288 186 284" /><path d="M112 342 Q134 359 157 347 M163 347 Q186 359 208 342" /></> : <><path d="M160 154 L160 316" /><path d="M117 215 Q160 229 203 215 M128 276 Q160 284 192 276" /></>}
    </g>
  </svg>;
}

export function BodyMapFigure({ view, zoneColor, zoneSeries }: FigureProps) {
  const region = (zone: Zone, d: string) => <Pair key={zone + d} zone={zone} d={d} zoneColor={zoneColor} zoneSeries={zoneSeries} />;
  return <Frame view={view}>
    {view === "front" ? <>
      {region("shoulders", "M95 138 C77 137 68 153 70 174 C72 192 80 205 91 207 C101 199 108 184 109 167 C109 154 104 143 95 138 Z")}
      {region("chest", "M112 145 Q132 143 156 151 L157 211 C143 220 124 217 111 207 C105 195 104 172 112 145 Z")}
      {region("biceps", "M79 201 C88 207 96 206 103 198 C104 218 97 244 84 259 C73 253 69 237 70 223 Z")}
      {region("forearms", "M70 254 Q83 261 94 246 C98 269 87 308 77 334 L56 382 C47 380 48 363 52 339 C56 307 63 274 70 254 Z")}
      {region("core", "M128 219 Q142 223 157 222 L157 309 Q146 315 136 308 C127 290 123 270 126 251 Z")}
      {region("core", "M110 210 Q118 220 128 222 C124 252 127 287 136 308 C122 306 118 293 121 276 C122 251 113 231 110 210 Z")}
      {region("quad", "M111 342 Q129 349 155 350 C156 388 150 432 142 469 C128 475 115 468 108 448 C101 415 103 371 111 342 Z")}
      {region("adductors", "M155 354 C150 379 149 415 143 439 C148 451 154 449 157 438 L160 379 Z")}
      {region("calves", "M116 479 C126 486 138 485 146 478 C146 507 140 541 136 560 C128 565 117 559 115 550 C111 527 114 498 116 479 Z")}
    </> : <>
      {region("shoulders", "M96 137 C77 137 68 153 70 172 C72 189 80 201 92 204 C103 196 109 181 109 165 C109 151 103 142 96 137 Z")}
      {region("back", "M115 140 Q136 150 158 151 L158 229 C142 214 124 199 111 181 C110 165 112 151 115 140 Z")}
      {region("back", "M111 182 C124 201 142 214 157 231 L157 276 C144 271 130 260 123 248 C115 230 109 205 111 182 Z")}
      {region("back", "M127 268 Q140 279 157 278 L157 323 C145 322 131 314 124 302 C122 289 124 279 127 268 Z")}
      {region("triceps", "M78 198 Q89 207 102 196 C105 221 98 246 85 262 C73 256 69 237 69 221 Z")}
      {region("forearms", "M69 255 Q81 262 94 245 C97 270 87 306 77 333 L56 381 C47 381 48 363 52 339 C56 308 63 274 69 255 Z")}
      {region("glutes", "M113 340 Q135 349 158 347 L158 390 C149 401 126 403 113 390 C105 375 106 352 113 340 Z")}
      {region("hamstring", "M111 392 C127 402 145 400 155 390 C153 422 149 453 143 474 C127 479 113 469 108 450 C103 430 105 408 111 392 Z")}
      {region("calves", "M117 480 C127 486 138 485 146 478 C147 507 141 541 136 559 C127 566 117 559 115 549 C111 524 114 495 117 480 Z")}
    </>}
  </Frame>;
}
