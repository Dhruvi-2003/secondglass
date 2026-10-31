const assets = {
  sony: "sony.svg", canon: "canon.png", nikon: "nikon.svg",
  sigma: "sigma.svg", fujifilm: "fujifilm.png", tamron: "tamron.svg",
};
export function brandLogo(brand) {
  const key = String(brand || "").trim().toLowerCase();
  return assets[key] ? {src: `assets/brands/${assets[key]}`, key} : null;
}
