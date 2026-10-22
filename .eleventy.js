const yaml = require("js-yaml");

module.exports = function (eleventyConfig) {
  // Content lives in YAML files under src/_data — easier to edit than JSON.
  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));

  // Static assets copied through untouched.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Custom domain: create src/CNAME containing the domain and it is copied through.
  if (require("fs").existsSync("src/CNAME")) eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });

  // --- filters -------------------------------------------------------------
  // "2025-08-14" -> "Aug 2025"
  eleventyConfig.addFilter("monthYear", (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  });
  // "2025-08-14" -> "2025.08"
  eleventyConfig.addFilter("dotDate", (d) => {
    const dt = new Date(d);
    return `${dt.getUTCFullYear()}.${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  // "2025-08-14" -> "14 August 2025"
  eleventyConfig.addFilter("longDate", (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  });
  // newest first by a date field
  eleventyConfig.addFilter("byDateDesc", (arr, key = "date") =>
    [...arr].sort((a, b) => new Date(b[key]) - new Date(a[key])));
  eleventyConfig.addFilter("where", (arr, key, val) => (arr || []).filter(x => x && x[key] === val));
  eleventyConfig.addFilter("em", (str) => String(str ?? "").replace(/\*([^*]+)\*/g, "<em>$1</em>"));
  eleventyConfig.addFilter("split", (s, sep) => String(s).split(sep));
  eleventyConfig.addFilter("take", (arr, n) => arr.slice(0, n));
  // group members: longest tenure first (by "joined"), alphabetical by last name within a year
  eleventyConfig.addFilter("byTenure", (arr) => [...(arr || [])].sort((a, b) => {
    const ja = Number(a.joined) || 0, jb = Number(b.joined) || 0;
    if (ja !== jb) return ja - jb;
    const la = String(a.name).trim().split(/\s+/).pop().toLowerCase();
    const lb = String(b.name).trim().split(/\s+/).pop().toLowerCase();
    return la.localeCompare(lb);
  }));
  // alumni: chronological by the first year in "years" ("2021–2025" -> 2021)
  eleventyConfig.addFilter("byYears", (arr) => [...(arr || [])].sort((a, b) =>
    (parseInt(String(a.years)) || 0) - (parseInt(String(b.years)) || 0) || String(a.name).localeCompare(String(b.name))));
  // find one item by a field value: publications | find("n", 19)
  eleventyConfig.addFilter("find", (arr, key, val) => (arr || []).find((x) => x[key] == val));
  // group publications by year, newest first
  eleventyConfig.addFilter("groupByYear", (arr) => {
    const map = new Map();
    for (const p of arr) {
      if (!map.has(p.year)) map.set(p.year, []);
      map.get(p.year).push(p);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([year, items]) => ({ year, items }));
  });
  // bold group members in author strings: "Tassanov, A." -> <b>Tassanov, A.</b>
  eleventyConfig.addFilter("boldMembers", (authors, members) => {
    let out = authors;
    for (const m of members || []) {
      out = out.split(m).join(`<b>${m}</b>`);
    }
    return out;
  });
  // chemical formulae: digits after a letter or ) become subscripts, e.g. AMM'Q3 -> AMM'Q<sub>3</sub>
  eleventyConfig.addFilter("chem", (s) =>
    String(s).replace(/([A-Za-z\)\]′'])(\d+(?:\.\d+)?)/g, "$1<sub>$2</sub>"));

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
