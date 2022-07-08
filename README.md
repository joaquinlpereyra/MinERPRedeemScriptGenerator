# Minimal ERP Redeem Script Generator

A small-as-possible tool that generates ERP Redeem Scripts. To be 
used by RSKJ's testcases to compare with their implementation.

# Usage

```
npx ts-node index.ts {number of iterations} {output file} {create invalid}
```

All arguments are optional. Nees [ts-node](https://github.com/TypeStrong/ts-node) or compiling the typsecript somehow.

- Number of iterations is the number of redeem scripts that will be generated.
- Output file: JSON file where the redeem scripts will be saved.
- Create invalid: generate obviously invalid redeem scripts, like ones having more than 16 members in federations.

Create invalid is useful to generate testcases for scripts that _should_ be rejected.

See this commit on my own fork of RSKJ for example usage after the tests have been generated: https://github.com/joaquinlpereyra/rskj/commit/8c0117096d4bf252f837cd0ed981e937d343a262

# Generated JSON Example

```
~/MinERPRedeemScriptGenerator ❯❯❯ cat scripts.json | jq '.[0]'
{
  "mainFed": [
    "03097fdb3411228502448fb145d26e1b95eb9493f177d07a7458e2cbc4a341baba",
    "03203ffe3f1ae3a5077888197aa4b558c9ee80e2bfe8ac964a5494c73154341e62",
    "030f079aaf404701e266998930b92a944ab5e38de09e06cde2cadbb522ba6fbdb6"
  ],
  "emergencyFed": [
    "0230d24336ca0c9aa4b45c8098063c99638f2f205869d66259897bc3e9f6f4faaf",
    "02370ad60f7118eb63a6b804cf549114345302f315d6682a39f78b34f3198643a1"
  ],
  "timelock": 51691,
  "script": "64522103097fdb3411228502448fb145d26e1b95eb9493f177d07a7458e2cbc4a341baba21030f079aaf404701e266998930b92a944ab5e38de09e06cde2cadbb522ba6fbdb62103203ffe3f1ae3a5077888197aa4b558c9ee80e2bfe8ac964a5494c73154341e62536703ebc900b27552210230d24336ca0c9aa4b45c8098063c99638f2f205869d66259897bc3e9f6f4faaf2102370ad60f7118eb63a6b804cf549114345302f315d6682a39f78b34f3198643a15268ae"
}
```
