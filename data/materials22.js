/* 22 materials, 7 families.
   rho (kg/m3) and E (GPa): CES/Granta values as tabulated in "Ashby's Maps, Renewed", Table 1.
   sigma (MPa, yield or, for ceramics, flexural strength) and Cm (GBP/kg): approximate mid-range
   handbook values added for teaching, not database values. */
window.MAT22 = [
  { family: "Elastomers", name: "Natural rubber", rho: 950, E: 0.00165, sigma: 22, Cm: 2.5 },
  { family: "Elastomers", name: "Polyurethane", rho: 1200, E: 0.01625, sigma: 30, Cm: 4.5 },
  { family: "Composites", name: "Al/SiC composite", rho: 2780, E: 90.5, sigma: 350, Cm: 25 },
  { family: "Composites", name: "CFRP epoxy", rho: 1565, E: 54.9, sigma: 750, Cm: 38 },
  { family: "Composites", name: "GFRP epoxy", rho: 1860, E: 21.4, sigma: 150, Cm: 18 },
  { family: "Foams", name: "Flexible polymer foam", rho: 54, E: 0.002, sigma: 0.5, Cm: 2.5 },
  { family: "Foams", name: "Rigid polymer foam", rho: 320, E: 0.34, sigma: 3, Cm: 14 },
  { family: "Metals & alloys", name: "Al-alloys", rho: 2755, E: 72, sigma: 250, Cm: 2.2 },
  { family: "Metals & alloys", name: "Nickel", rho: 8890, E: 205, sigma: 200, Cm: 20 },
  { family: "Metals & alloys", name: "Stainless steel", rho: 7740, E: 200, sigma: 400, Cm: 5.5 },
  { family: "Metals & alloys", name: "Titanium alloys", rho: 4610, E: 115, sigma: 900, Cm: 22 },
  { family: "Polymers", name: "Epoxies", rho: 1270, E: 2.41, sigma: 55, Cm: 2.3 },
  { family: "Polymers", name: "Phenolics", rho: 1280, E: 3.795, sigma: 40, Cm: 1.5 },
  { family: "Polymers", name: "Polyamides", rho: 1135, E: 1.49, sigma: 60, Cm: 3 },
  { family: "Polymers", name: "Polycarbonate", rho: 1200, E: 2.38, sigma: 63, Cm: 3.2 },
  { family: "Natural materials", name: "Hardwood oak", rho: 940, E: 22.9, sigma: 45, Cm: 1.5 },
  { family: "Natural materials", name: "Plywood", rho: 750, E: 6.5, sigma: 30, Cm: 0.8 },
  { family: "Natural materials", name: "Softwood pine", rho: 520, E: 9.35, sigma: 40, Cm: 0.8 },
  { family: "Technical ceramics", name: "Alumina", rho: 3700, E: 330, sigma: 300, Cm: 18 },
  { family: "Technical ceramics", name: "Silicon carbide", rho: 3100, E: 400, sigma: 400, Cm: 15 },
  { family: "Technical ceramics", name: "Silicon nitride", rho: 3195, E: 310, sigma: 600, Cm: 30 },
  { family: "Technical ceramics", name: "Zirconia", rho: 5400, E: 200, sigma: 700, Cm: 30 },
];
