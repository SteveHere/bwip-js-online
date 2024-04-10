// bwip-js/examples/drawing-svg.js
//
// This is an advanced demonstation of using the drawing interface.
//
// Converts the drawing primitives into the equivalent SVG.  Linear barcodes
// are rendered as a series of stroked paths.  2D barcodes are rendered as a 
// series of filled paths.
//
// Rotation is handled during drawing.  The resulting SVG will contain the 
// already-rotated barcode without an SVG transform.
//
// If the requested barcode image contains text, the glyph paths are 
// extracted from the font file (via the builtin FontLib and stb_truetype.js)
// and added as filled SVG paths.
//
// This code can run in the browser and in nodejs.
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DrawingSVG = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    "use strict";

    function DrawingSVG(opts, FontLib, integers_only=false, textScale={width:1, height:1}, textOffset={x:0, y:0}) {
        let rot = 'N';
        // Unrolled x,y rotate/translate matrix
        var tx0 = 0, tx1 = 0, tx2 = 0, tx3 = 0;
        var ty0 = 0, ty1 = 0, ty2 = 0, ty3 = 0;

        let svg = [];
        var path;
        var lines = {};

        // Magic number to approximate an ellipse/circle using 4 cubic beziers.
        const ELLIPSE_MAGIC = 0.55228475 - 0.00045;

        // Global graphics state
        var gs_width, gs_height;    // image size, in pixels
        var gs_dx, gs_dy;           // x,y translate (padding)

        let glyph_defs = [];

        return {
            // Make no adjustments
            scale(sx, sy) {
            },
            // Measure text.  This and scale() are the only drawing primitives that
            // are called before init().
            //
            // `font` is the font name typically OCR-A or OCR-B.
            // `fwidth` and `fheight` are the requested font cell size.  They will
            // usually be the same, except when the scaling is not symetric.
            measure(str, font, fwidth, fheight) {
                fwidth = fwidth|0, fheight = fheight|0;

                const fontid = FontLib.lookup(font);
                let width = 0, ascent = 0, descent = 0;
                for (let i = 0; i < str.length; i++) {
                    let glyph = FontLib.getpaths(fontid, str.charCodeAt(i), fwidth, fheight);
                    if (!glyph) { continue; }
                    ascent  = Math.max(ascent, glyph.ascent);
                    descent = Math.max(descent, -glyph.descent);
                    width  += glyph.advance;
                }
                return { width, ascent, descent };
            },

            // width and height represent the maximum bounding box the graphics will occupy.
            // The dimensions are for an unrotated rendering.  Adjust as necessary.
            init(width, height) {
                // Add in the effects of padding.  These are always set before the
                // drawing constructor is called.
                const padl = opts.paddingleft, padr = opts.paddingright, 
                    padt = opts.paddingtop, padb = opts.paddingbottom; 
                rot = opts.rotate || 'N';

                width  += padl + padr;
                height += padt + padb;

                // Transform indexes are: x, y, w, h
                switch (rot) {
                    // tx = w-y, ty = x
                    case 'R': tx1 = -1; tx2 = 1; ty0 = 1; break;
                    // tx = w-x, ty = h-y
                    case 'I': tx0 = -1; tx2 = 1; ty1 = -1; ty3 = 1; break;
                    // tx = y, ty = h-x
                    case 'L': tx1 = 1; ty0 = -1; ty3 = 1; break;
                    // tx = x, ty = y
                    default:  tx0 = ty1 = 1; break;
                }

                // Setup the graphics state
                const swap = rot == 'L' || rot == 'R';
                gs_width  = swap ? height : width;
                gs_height = swap ? width : height;
                gs_dx = padl;
                gs_dy = padt;

                svg = [];
            },
            // Unconnected stroked lines are used to draw the bars in linear barcodes.
            // No line cap should be applied.  These lines are always orthogonal.
            line(x0, y0, x1, y1, lw, rgb) {
                // Try to get non-blurry lines...
                x0 = x0|0; x1 = x1|0;
                y0 = y0|0; y1 = y1|0;
                lw = Math.round(lw);

                // Try to keep the lines "crisp" by using with the SVG line drawing spec to
                // our advantage.
                if (lw & 1) {
                    if (x0 == x1) { x0 += 0.5; x1 += 0.5; }
                    if (y0 == y1) { y0 += 0.5; y1 += 0.5; }
                }

                // Group together all lines of the same width and emit as single paths.
                // Dramatically reduces resulting text size.
                const key = `${lw}#${rgb}`;
                if (!lines[key]) {
                    lines[key] = `<path class="not-text" stroke="#${rgb}" stroke-width="${lw}" d="`;
                }
                lines[key] += 'M' + transform(x0, y0) + 'L' + transform(x1, y1);
            },
            // Polygons are used to draw the connected regions in a 2d barcode.
            // These will always be unstroked, filled, non-intersecting,
            // orthogonal shapes.
            // You will see a series of polygon() calls, followed by a fill().
            polygon(pts) {
                if (!path) {
                    path = '<path class="not-text" d="';
                }
                path += 'M' + transform(pts[0][0], pts[0][1]) + pts.slice(1).map(([x,y])=>'L' + transform(x, y)).join('') + 'Z ';
            },
            // An unstroked, filled hexagon used by maxicode.  You can choose to fill
            // each individually, or wait for the final fill().
            //
            // The hexagon is drawn from the top, counter-clockwise.
            hexagon(pts, rgb) {
                this.polygon(pts); // A hexagon is just a polygon...
            },
            // An unstroked, filled ellipse.  Used by dotcode and maxicode at present.
            // maxicode issues pairs of ellipse calls (one cw, one ccw) followed by a fill()
            // to create the bullseye rings.  dotcode issues all of its ellipses then a
            // fill().
            ellipse(x, y, rx, ry, ccw) {
                if (!path) {
                    path = '<path class="not-text" d="';
                }
                const dx = rx * ELLIPSE_MAGIC, dy = ry * ELLIPSE_MAGIC;

                // Since we fill with even-odd, don't worry about cw/ccw
                path += 'M' + transform(x - rx, y     ) +
                        'C' + transform(x - rx, y - dy) + transform(x - dx, y - ry) + transform(x     , y - ry) +
                        'C' + transform(x + dx, y - ry) + transform(x + rx, y - dy) + transform(x + rx, y     ) + 
                        'C' + transform(x + rx, y + dy) + transform(x + dx, y + ry) + transform(x     , y + ry) +  
                        'C' + transform(x - dx, y + ry) + transform(x - rx, y + dy) + transform(x - rx, y     ) + 
                        'Z ';
            },
            // PostScript's default fill rule is even-odd.
            fill(rgb) {
                if (path) {
                    svg.push(`${path}" fill="#${rgb}" fill-rule="evenodd" />`);
                    path = null;
                }
            },
            // Draw text with optional inter-character spacing.  `y` is the baseline.
            // font is an object with properties { name, width, height, dx }
            // width and height are the font cell size.
            // dx is extra space requested between characters (usually zero).
            text(x, y, str, rgb, font) {
                const fontid  = FontLib.lookup(font.name);
                const fwidth  = (font.width * textScale.width)|0, fheight = (font.height * textScale.height)|0;
                // const fwidth  = font.width|0, fheight = (font.height * textScale.height)|0;
                const dx = (font.dx * textScale.width)|0;
                // y = y - font.height + fheight;
                // New algo uses relative positioning & glyph reuse via <def></def>
                //  ┌--- Change this conditional to 'false' to revert back to absolute positioning & duplicate glyphs
                //  v
                const chars = new Set(str.split(""));
                let glyph_href_map = new Map();
                // Create the defs
                for (let k = 0; k < str.length; k++) {
                    const charCode = str.charCodeAt(k)
                    if (glyph_href_map.has(charCode)) { continue; }
                    const glyph = FontLib.getpaths(fontid, charCode, font.width|0, font.height|0);
                    if (!glyph) { continue; }
                    if (glyph.length > 0) {
                        // A glyph is composed of sequence of curve and line segments.
                        // M is move-to
                        // L is line-to
                        // Q is quadratic bezier curve-to
                        // C is cubic bezier curve-to
                        if (glyph[0].type !== 'M'){
                            throw new Error("Text glyph doesn't start with 'M' command");
                        }
                        
                        const [initial_x, initial_y] = transformRaw(glyph[0].x + x, y - glyph[0].y)
                        let prev_x = initial_x, prev_y = initial_y;
                        const translate = ([x, y])=>`${x - prev_x},${y - prev_y} `;
                        let path = [`${glyph[0].type}0,0 `];

                        for (let i = 1; i < glyph.length; i++) {
                            const seg = glyph[i];
                            const new_coords = transformRaw(seg.x + x , y - seg.y);
                            if (seg.type == 'M' || seg.type == 'L') {
                                path.push(seg.type.toLowerCase() + translate(new_coords));
                            } else if (seg.type == 'Q') {
                                path.push('q' + translate(transformRaw(seg.cx + x , y - seg.cy)) + translate(new_coords));

                            } else if (seg.type == 'C') {
                                path.push('c' + translate(transformRaw(seg.cx1 + x, y - seg.cy1)) + 
                                translate(transformRaw(seg.cx2 + x, y - seg.cy2)) + translate(new_coords));
                            }
                            [prev_x, prev_y] = new_coords;
                        }
                        // Close the shape, and push it to the array
                        glyph_href_map.set(
                            charCode, 
                            `<g id="text_${charCode}"><path class="text" d="${path.join("")}Z"/></g>`
                        );
                    }
                }
                for (const def of glyph_href_map.values()){
                    glyph_defs.push(def);
                }

                let glyphs = [];
                let start_x = undefined, start_y = undefined;
                for (let k = 0; k < str.length; k++) {
                    const glyph = FontLib.getpaths(fontid, str.charCodeAt(k), font.width|0, font.height|0);
                    let initial_x = undefined, initial_y = undefined;
                    if (!glyph) { continue; }
                    if (glyph.length > 0) {
                        if (glyph[0].type !== 'M'){
                            throw new Error("Text glyph doesn't start with 'M' command");
                        }
                        [initial_x, initial_y] = transformRaw(glyph[0].x + x, y - glyph[0].y);
                        if (start_x === undefined || start_y === undefined) {
                            [start_x, start_y] = [initial_x, initial_y];
                        }
                    }
                    if (initial_x === undefined || initial_y === undefined) {
                        throw new Error("Glyph placement position cannot be found.");
                    }
                    glyphs.push(`<use href="#text_${str.charCodeAt(k)}" x="${initial_x - start_x}" y="${initial_y - start_y}" />`);
                    x += glyph.advance + dx;
                }
                if (glyphs.length > 0) {
                    const transforms = `translate(${start_x}, ${start_y})`
                    + `translate(${textOffset.x}, ${textOffset.y})`
                    + ( (rot === 'N' || rot === 'I') ?
                        `scale(${textScale.width}, ${textScale.height}) ` :
                        `scale(${textScale.height}, ${textScale.width}) `
                    );
                    svg.push(`<g class="text" transform="${transforms}">\n\t\t${glyphs.join("\n\t\t")}\n\t</g>`);
                }
            },
            // Called after all drawing is complete.  The return value from this method
            // is the return value from `bwipjs.render()`.
            end() {
                const linesvg = Object.values(lines).map(l=>`${l}" />`).join('\n\t\t');
                const bg = opts.backgroundcolor;
                return [
                    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${gs_width}" height="${gs_height}" viewBox="0 0 ${gs_width} ${gs_height}" preserveAspectRatio="xMidYMid meet">`,
                    `\t<def>${glyph_defs.join("\n\t\t")}</def>`,
                    /^[0-9A-Fa-f]{6}$/.test(''+bg) ? `\t<rect id="barcodeBG" width="100%" height="100%" fill="#${bg}" />` : '',
                    `\t<g id="linesArea">\n\t\t${linesvg}\n\t</g>`,
                    `\t${svg.join("\n\t")}`,
                    '</svg>'
                ].join("\n")
            },
        };

        function roundTo2DP(x){ return Math.round(x * 100) / 100; }

        // translate/rotate and return as an SVG coordinate pair
        function transform(x, y) {
            x += gs_dx;
            y += gs_dy;
            let tx = tx0 * x + tx1 * y + tx2 * (gs_width-1) + tx3 * (gs_height-1);
            let ty = ty0 * x + ty1 * y + ty2 * (gs_width-1) + ty3 * (gs_height-1);
            return `${integers_only ? Math.round(tx) : roundTo2DP(tx)},${integers_only ? Math.round(ty) : roundTo2DP(ty)} `;
        }

        function transformRaw(x, y) {
            x += gs_dx;
            y += gs_dy;
            let tx = tx0 * x + tx1 * y + tx2 * (gs_width-1) + tx3 * (gs_height-1);
            let ty = ty0 * x + ty1 * y + ty2 * (gs_width-1) + ty3 * (gs_height-1);
            return integers_only ? [Math.round(tx), Math.round(ty)] : [roundTo2DP(tx), roundTo2DP(ty)];
        }
    }

    return DrawingSVG;
}));
