// Original vector buildings: no external images, fonts or asset licenses required.
const colors = [null, ['#edba88','#e17e58','#fff2cc'], ['#f1d2a1','#72a594','#fff9dc'], ['#a6c4d8','#678ea9','#fff0bd'], ['#efbaab','#c57261','#fff4d8'], ['#c6d49a','#7c9d76','#faf3cb'], ['#b7c9cf','#5b8194','#fff0b9'], ['#d5bfdb','#9982b4','#fff0cb'], ['#dfc995','#c39a57','#fff6d9']];
export function building(level, className = '') {
  if (!level) return '';
  const [wall, roof, windowColor] = colors[level] || colors[8];
  let shape;
  if (level === 1) {
    shape = `<path d="M23 47 50 24 77 47v34H23Z" fill="${wall}"/><path d="M17 48 50 19 83 48l-5 5-28-24-28 24Z" fill="${roof}"/><path d="M65 23h8v18h-8Z" fill="${roof}"/><rect x="42" y="59" width="16" height="22" rx="7" fill="#ad795b"/><rect x="29" y="54" width="10" height="11" rx="2" fill="${windowColor}"/><rect x="62" y="54" width="10" height="11" rx="2" fill="${windowColor}"/><path d="M45 68v-6l4 3 4-3v6" fill="#4f6260"/>`;
  } else if (level === 2) {
    shape = `<rect x="22" y="44" width="58" height="37" rx="3" fill="${wall}"/><path d="M15 47 37 22h30l20 25Z" fill="${roof}"/><path d="M32 47V33l12-11 12 11v14Z" fill="${wall}"/><rect x="38" y="32" width="12" height="13" rx="5" fill="${windowColor}"/><rect x="33" y="55" width="12" height="13" rx="2" fill="${windowColor}"/><rect x="59" y="54" width="12" height="27" rx="6" fill="#ac956e"/><path d="M20 80h62v5H20Z" fill="#c4b68d"/><circle cx="23" cy="71" r="10" fill="#8eb07b"/>`;
  } else if (level === 5) {
    shape = `<path d="M31 81 48 46 64 81Z" fill="#dacaa4"/><rect x="28" y="37" width="6" height="37" rx="3" fill="#aa8964"/><circle cx="31" cy="35" r="18" fill="${roof}"/><circle cx="39" cy="27" r="15" fill="${wall}"/><rect x="66" y="41" width="5" height="35" rx="2" fill="#aa8964"/><circle cx="69" cy="38" r="15" fill="${roof}"/><path d="M46 65h23v5H46Zm3 5h3v7h-3Zm15 0h3v7h-3Z" fill="#9f775d"/><path d="m15 78 4-7 5 7v6h-9Z" fill="#e7b382"/>`;
  } else {
    const top = level === 3 || level === 4 ? 32 : 16;
    shape = `<rect x="26" y="${top + 9}" width="49" height="${72 - top}" rx="3" fill="${wall}"/><path d="M21 ${top + 13} 30 ${top}h42l9 13Z" fill="${roof}"/><rect x="46" y="65" width="13" height="16" rx="6" fill="${roof}"/>`;
    for (let y = top + 20; y < 63; y += 16) for (const x of [33, 48, 63]) shape += `<rect x="${x}" y="${y}" width="7" height="9" rx="2" fill="${windowColor}"/>`;
    if (level === 4) shape += `<path d="M22 62h57v10H22Z" fill="#fbecd1"/><path d="M22 62h9v10h-9Zm18 0h9v10h-9Zm18 0h9v10h-9Z" fill="${roof}"/>`;
    if (level >= 6) shape += `<path d="M37 ${top + 1}v-9l7 7 13-1 7-6v10" fill="${roof}"/><circle cx="47" cy="${top + 7}" r="2" fill="#f9edcf"/><circle cx="56" cy="${top + 7}" r="2" fill="#f9edcf"/>`;
  }
  return `<svg class="building ${className}" viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="83" rx="36" ry="7" fill="#547963" opacity=".13"/>${shape}<path d="M78 80v-6m-3 4 3 2 3-2" stroke="#7a9e72" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
}

export function heroArt() {
  return `<svg viewBox="0 0 300 170" aria-hidden="true"><ellipse cx="148" cy="137" rx="124" ry="23" fill="#e5e8d9"/><path d="m30 137 104-54 135 54-117 26Z" fill="#d5dfc9"/><path d="m114 94 18-9 108 55-18 8Z" fill="#ede6cd"/><g transform="translate(15 23) scale(.94)">${building(2).replace(/<svg[^>]*>|<\/svg>/g,'')}</g><g transform="translate(105 -2) scale(1.3)">${building(3).replace(/<svg[^>]*>|<\/svg>/g,'')}</g><g transform="translate(202 53) scale(.72)">${building(1).replace(/<svg[^>]*>|<\/svg>/g,'')}</g><path d="M62 132v-24m-12 0c-3-16 23-20 25-3 6 15-26 19-25 3" fill="#91ab7f"/><path d="m189 137 2-12 5 4 6-5 3 12c0 11-17 12-16 1" fill="#db9b76"/><path d="M205 139q15 1 12-9" stroke="#db9b76" stroke-width="5" fill="none" stroke-linecap="round"/><path d="m253 49 3-6 3 6 6 3-6 3-3 6-3-6-6-3Z" fill="#d9ad6d"/><path d="m57 25 2-4 2 4 4 2-4 2-2 4-2-4-4-2Z" fill="#d9ad6d"/></svg>`;
}
