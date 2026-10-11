# Cross Compiler Platform

Mini project for Compiler Design Laboratory, Experiment 10: Implementation of a compiler for a source program using a cross compiler approach.

## Features

- Source program editor for a small C-like language
- Lexical analysis with token display
- Syntax analysis and syntax error reporting
- Semantic analysis using a symbol table
- Abstract Syntax Tree display
- Three Address Code generation
- Constant folding / constant propagation optimization
- Target code generation for:
  - C
  - ARM-style assembly
  - RISC-V-style assembly
- Simulated execution output
- Visual compiler-flow panel and process animation
- Flex/Bison scanner and parser specifications
- LaTeX project report with screenshots

## Project Structure

```text
dist/
  index.html
  styles.css
  app.js
flex-bison/
  compiler.l
  parser.y
  sample.src
  README.md
report/
  cross_compiler_report.tex
  img1.png ... img5.png
```

## Run the Web App

Open `dist/index.html` in a browser, or serve it locally:

```bash
cd dist
python -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Build Flex/Bison Version

```bash
cd flex-bison
bison -d parser.y
flex compiler.l
gcc parser.tab.c lex.yy.c -o cross_compiler
./cross_compiler < sample.src
```

On Windows, use a Unix-like environment such as WSL, MSYS2, or MinGW with Flex, Bison, and GCC installed.

## Sample Program

```c
int a = 10;
int b = 20;
int c;
c = a + b * 2;
print c;
```

Expected simulated output:

```text
50
```

## Report

The LaTeX report is available at:

```text
report/cross_compiler_report.tex
```

The report images are named `img1.png` to `img5.png`.
