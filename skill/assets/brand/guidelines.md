# Skylos — guía rápida de marca

Documento corto para que Manu (y cualquiera del equipo) no se desvíen al
escribir o diseñar en nombre de Skylos.

## Voz

- **Directa**. Sin relleno de consultora. Si algo no se sabe, decirlo.
- **Cercana, no informal de más**. Tuteo en es-BO. "Ustedes" para
  empresas. Nunca "Don" / "Sra." salvo que el contacto lo use primero.
- **Técnica cuando aporta**. No esconder términos por miedo a que no se
  entiendan — si "modelo de lenguaje" es lo más preciso, se dice así y
  se explica una vez.
- **Honesta con la incertidumbre**. "Esto probablemente funcione, no
  podemos prometer X" es mejor que "garantizamos resultados".

## Qué evitar

- Promesas de ROI sin un cálculo concreto del por qué
- "Disrupción", "revolucionario", "transformador" en bullet points
- Mayúsculas para énfasis (usar negrita)
- Emojis decorativos en contextos comerciales — sí en internos
- Hablar de Manu como "asistente virtual" — es "el agente" o "Manu"

## Paleta

| Token | Hex | Uso |
|---|---|---|
| Blue | `#2D5BFF` | acción primaria, links, focus |
| Magenta | `#E536A8` | acento, alertas suaves, énfasis |
| Cyan | `#29D6E5` | acento terciario, badges positivos |
| Foreground | `#1A202C` | texto principal |
| Foreground muted | `#4A5568` | texto secundario |
| Background | `#F2F4F7` | fondo de app |
| Surface | `#FFFFFF` | cards |

**Gradiente firma**: `linear-gradient(115deg, #2D5BFF 0%, #E536A8 50%, #29D6E5 100%)`.
Reservado para momentos clave: login hero, header de dashboard, card más
importante de stats. No para llenar.

## Tipografías

- **Winner Sans** — display: títulos, cifras destacadas, logo
- **Geist** — UI body: todo lo demás

## Logo + cristales

Logo SVG en `assets/brand/logo-skylos.svg`. Los cristales 3D
iridiscentes están en `web/public/crystals/` para uso UI; sirven como
referencia visual pero no se usan en comunicación escrita.

## Firma estándar

Cierre de propuestas / mails formales:

```
— {{author_name}}
Skylos
skylos.solutions
```

Cierre WhatsApp / chat:

```
— {{author_name}}
```
