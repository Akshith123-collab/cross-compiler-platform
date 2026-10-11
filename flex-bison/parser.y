%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int yylex(void);
void yyerror(const char *s);

typedef struct Symbol {
  char name[32];
  char type[16];
} Symbol;

Symbol table[100];
int symbol_count = 0;
int temp_count = 0;

int lookup(const char *name) {
  for (int i = 0; i < symbol_count; i++) {
    if (strcmp(table[i].name, name) == 0) return i;
  }
  return -1;
}

void insert_symbol(const char *name, const char *type) {
  if (lookup(name) == -1) {
    strcpy(table[symbol_count].name, name);
    strcpy(table[symbol_count].type, type);
    symbol_count++;
  } else {
    printf("Semantic error: duplicate declaration of %s\n", name);
  }
}

char *new_temp(void) {
  char *temp = malloc(12);
  sprintf(temp, "t%d", ++temp_count);
  return temp;
}
%}

%union {
  int num;
  char *id;
}

%token INT PRINT ASSIGN PLUS MINUS STAR SLASH LPAREN RPAREN SEMICOLON
%token <num> NUMBER
%token <id> ID
%type <id> expr term factor

%%
program:
    statements
    ;

statements:
    statements statement
  | statement
  ;

statement:
    INT ID SEMICOLON
      { insert_symbol($2, "int"); }
  | INT ID ASSIGN expr SEMICOLON
      { insert_symbol($2, "int"); printf("%s = %s\n", $2, $4); }
  | ID ASSIGN expr SEMICOLON
      {
        if (lookup($1) == -1) printf("Semantic error: undeclared %s\n", $1);
        printf("%s = %s\n", $1, $3);
      }
  | PRINT expr SEMICOLON
      { printf("print %s\n", $2); }
  ;

expr:
    expr PLUS term
      { char *t = new_temp(); printf("%s = %s + %s\n", t, $1, $3); $$ = t; }
  | expr MINUS term
      { char *t = new_temp(); printf("%s = %s - %s\n", t, $1, $3); $$ = t; }
  | term
      { $$ = $1; }
  ;

term:
    term STAR factor
      { char *t = new_temp(); printf("%s = %s * %s\n", t, $1, $3); $$ = t; }
  | term SLASH factor
      { char *t = new_temp(); printf("%s = %s / %s\n", t, $1, $3); $$ = t; }
  | factor
      { $$ = $1; }
  ;

factor:
    NUMBER
      { char *buf = malloc(16); sprintf(buf, "%d", $1); $$ = buf; }
  | ID
      {
        if (lookup($1) == -1) printf("Semantic error: undeclared %s\n", $1);
        $$ = $1;
      }
  | LPAREN expr RPAREN
      { $$ = $2; }
  ;
%%

void yyerror(const char *s) {
  printf("Syntax error: %s\n", s);
}

int main(void) {
  printf("Enter source program. Press Ctrl+D/Ctrl+Z to compile.\n");
  yyparse();
  printf("\nSymbol table:\n");
  for (int i = 0; i < symbol_count; i++) {
    printf("%s\t%s\n", table[i].name, table[i].type);
  }
  return 0;
}
