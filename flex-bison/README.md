# Flex/Bison Compiler Core

These files provide the conventional Lex/Flex and Yacc/Bison implementation for the mini project grammar.

## Build

```bash
bison -d parser.y
flex compiler.l
gcc parser.tab.c lex.yy.c -o cross_compiler
```

## Run

```bash
./cross_compiler < sample.src
```

The browser app in `dist/` mirrors this grammar and displays each compiler phase visually: token stream, syntax result, semantic table, AST, TAC, optimized TAC, and target code.
