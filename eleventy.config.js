import "dotenv/config";

export default function (eleventyConfig) {
  eleventyConfig.addGlobalData("googleMapsKey", process.env.GOOGLE_MAPS_API_KEY || "");
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/images");

  return {
    dir: {
      input: "src",
      output: "_site",
    },
  };
}
