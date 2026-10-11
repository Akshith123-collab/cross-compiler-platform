%{
#include "parser.tab.h"
#include <stdlib.h>
#include <string.h>
%}

%%
"int"               { return INT; }
"print"             { return PRINT; }
[0-9]+              { yylval.num = atoi(yytext); return NUMBER; }
[A-Za-z_][A-Za-z0-9_]* {
                      yylval.id = strdup(yytext);
                      return ID;
                    }
"="                 { return ASSIGN; }
"+"                 { return PLUS; }
"-"                 { return MINUS; }
"*"                 { return STAR; }
"/"                 { return SLASH; }
"("                 { return LPAREN; }
")"                 { return RPAREN; }
";"                 { return SEMICOLON; }
[ \t\r\n]+          { /* skip whitespace */ }
.                   { printf("Lexical error: unknown character %s\n", yytext); }
%%

int yywrap(void) {
  return 1;
}
