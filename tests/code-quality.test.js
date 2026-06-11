/**
 * Tests for code quality standards across all JS modules.
 * Validates JSDoc, named constants, DOM safety, and module structure.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const jsFiles = readdirSync(resolve("js"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => ({
    name: f,
    content: readFileSync(resolve("js", f), "utf-8"),
  }));

describe("Code Quality Standards", () => {
  describe("Module Documentation", () => {
    jsFiles.forEach(({ name, content }) => {
      it(`${name} has @module JSDoc header`, () => {
        expect(content).toMatch(/@module\s+\w+/);
      });
    });
  });

  describe("No hacky cache-busting in imports", () => {
    jsFiles.forEach(({ name, content }) => {
      it(`${name} has no ?v= query strings in imports`, () => {
        const importLines = content.match(/import .+ from .+/g) || [];
        importLines.forEach((line) => {
          expect(line).not.toContain("?v=");
        });
      });
    });
  });

  describe("Named Constants (no magic numbers)", () => {
    jsFiles
      .filter(({ name }) => !["config.js", "data.js", "dashboard.js"].includes(name))
      .forEach(({ name, content }) => {
        it(`${name} uses UPPER_CASE constants for configuration values`, () => {
          const hasExports = content.includes("export");
          const hasConstants =
            content.match(/const [A-Z][A-Z_\d]+ =/g) || [];
          // Files with exports should have at least one named constant
          // (config.js and data.js are excluded as they ARE the constants)
          if (hasExports && content.length > 3000) {
            expect(hasConstants.length).toBeGreaterThan(0);
          }
        });
      });
  });

  describe("Safe DOM Manipulation", () => {
    jsFiles
      .filter(({ name }) => !["chatbot.js"].includes(name))
      .forEach(({ name, content }) => {
        it(`${name} does not use innerHTML`, () => {
          // chatbot.js has 1 safe usage with explicit comment
          expect(content).not.toContain(".innerHTML");
        });
      });

    it("chatbot.js innerHTML usage has safety comment", () => {
      const chatbot = jsFiles.find((f) => f.name === "chatbot.js");
      const lines = chatbot.content.split("\n");
      const innerHTMLLine = lines.findIndex((l) => l.includes(".innerHTML"));
      expect(innerHTMLLine).toBeGreaterThan(-1);
      // The line before should have the safety comment
      const commentLine = lines[innerHTMLLine - 1] || "";
      expect(commentLine).toContain("Safe");
    });
  });

  describe("Consistent Error Handling", () => {
    jsFiles
      .filter(({ content }) => content.includes("async"))
      .forEach(({ name, content }) => {
        it(`${name} uses try/catch in async functions`, () => {
          const asyncCount = (content.match(/async\s+function|async\s*\(/g) || []).length;
          const tryCatchCount = (content.match(/try\s*\{|catch\s*[({]/g) || []).length;
          // Files with async functions should have error handling
          if (asyncCount > 0) {
            expect(tryCatchCount).toBeGreaterThan(0);
          }
        });
      });
  });

  describe("ES Module Usage", () => {
    jsFiles
      .filter(({ name }) => !["features.js"].includes(name))
      .forEach(({ name, content }) => {
        it(`${name} uses import/export (no global pollution)`, () => {
          const hasImport = content.includes("import ");
          const hasExport = content.includes("export ");
          expect(hasImport || hasExport).toBe(true);
        });
      });

    it("no file uses var declarations", () => {
      jsFiles.forEach(({ name, content }) => {
        const varDeclarations = content.match(/\bvar\s+\w+/g) || [];
        expect(varDeclarations).toHaveLength(0);
      });
    });
  });

  describe("Formatting and Structure", () => {
    jsFiles.forEach(({ name, content }) => {
      it(`${name} uses const/let (not var)`, () => {
        // Check that no var is used outside of comments
        const lines = content.split("\n").filter(
          (l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"),
        );
        const codeOnly = lines.join("\n");
        const varMatches = codeOnly.match(/\bvar\s+/g) || [];
        expect(varMatches).toHaveLength(0);
      });
    });
  });
});

describe("Project Configuration", () => {
  it("has .prettierrc for consistent formatting", () => {
    const content = readFileSync(resolve(".prettierrc"), "utf-8");
    expect(content).toContain("printWidth");
    expect(content).toContain("semi");
  });

  it("has .editorconfig for editor consistency", () => {
    const content = readFileSync(resolve(".editorconfig"), "utf-8");
    expect(content).toContain("indent_style");
    expect(content).toContain("utf-8");
  });

  it("has ESLint configuration", () => {
    const content = readFileSync(resolve("eslint.config.js"), "utf-8");
    expect(content).toContain("eqeqeq");
    expect(content).toContain("no-var");
    expect(content).toContain("prefer-const");
  });

  it("has CI pipeline", () => {
    const content = readFileSync(resolve(".github/workflows/ci.yml"), "utf-8");
    expect(content).toContain("npm test");
    expect(content).toContain("node-version");
  });

  it("package.json has lint and test scripts", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"));
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts.lint).toBeDefined();
  });
});
