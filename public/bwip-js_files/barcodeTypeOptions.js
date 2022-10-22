window.intRange = function*(start,end,step=1){
    if (end > start){
        if (step <= 0) throw new Error("Step must be positive if start < end");
        for(let i = start; i <= end; i += step){
            yield i;
        }
    } else if(start > end){
        if (step >= 0) throw new Error("Step must be negative if start > end");
        for(let i = start; i >= end; i += step){
            yield i;
        }
    } else {
        yield start;
    }
}

window.barcodeVersions = {
    // The following bcids will not have selectable options:
    // Reason(s): Too many potential options, auto option works, options were just successive integers

    // hanxin | swissqrcode | gs1dlqrcode | gs1qrcode | qrcode

    "codeone": {
        options: [ "S-10", "S-20", "S-30", "T-16", "T-32", "T-48", "A", "B", "C", "D", "E", "F", "G", "H" ],
        default: "(auto)",
    },

    "code2of5": {
        options: [ "industrial" ],
        default: "industrial",
    },

    "posicode": {
        options: [ "a", "b", "limiteda", "limitedb" ],
        default: "a",
    },

    "microqrcode": {
        options: [ "M1", "M2", "M3", "M4" ],
        default: "(auto)",
    },

    "datamatrix": {
        optionsformatpairings: {
            "square": [ "10x10", "12x12", "14x14", "16x16", "18x18", "20x20", "22x22", "24x24", "26x26", "32x32", "36x36", "40x40", "44x44", "48x48", "52x52", "64x64", "72x72", "80x80", "88x88", "96x96", "104x104", "120x120", "132x132", "144x144" ],
            "rectangle": [ "8x18", "8x32", "12x26", "12x36", "16x36", "16x48" ],
        },
        // options: [ "10x10", "12x12", "14x14", "16x16", "18x18", "20x20", "22x22", "24x24", "26x26", "32x32", "36x36", "40x40", "44x44", "48x48", "52x52", "64x64", "72x72", "80x80", "88x88", "96x96", "104x104", "120x120", "132x132", "144x144" ],
        default: "(auto)",
    },

    "datamatrixrectangular": {
        options: [ "8x18", "8x32", "12x26", "12x36", "16x36", "16x48" ],
        default: "(auto)",
    },

    "datamatrixrectangularextension": {
        options: [ "8x18", "8x32", "8x48", "8x64", "8x80", "8x96", "8x120", "8x144", "12x26", "12x36", "12x64", "12x88", "16x36", "16x48", "16x64", "20x36", "20x44", "20x64", "22x48", "24x48", "24x64", "26x40", "26x48", "26x64" ],
        default: "(auto)",
    },

    "gs1datamatrix": {
        optionsformatpairings: {
            "square": [ "10x10", "12x12", "14x14", "16x16", "18x18", "20x20", "22x22", "24x24", "26x26", "32x32", "36x36", "40x40", "44x44", "48x48", "52x52", "64x64", "72x72", "80x80", "88x88", "96x96", "104x104", "120x120", "132x132", "144x144" ],
            "rectangle": [ "8x18", "8x32", "12x26", "12x36", "16x36", "16x48" ],
        },
        default: "(auto)",
    },

    "gs1datamatrixrectangular": {
        options: [ "8x18", "8x32", "12x26", "12x36", "16x36", "16x48" ],
        default: "(auto)",
    },

}

window.changeBarcodeOptions = (optionsSelectElement, barcodeType = "qrcode")=>{
    if (!symdesc.hasOwnProperty(barcodeType)) return;
    optionsSelectElement.innerHTML = '';
    if (window.barcodeVersions.hasOwnProperty(barcodeType)){
        let barcodeOptions = window.barcodeVersions[barcodeType];
        if (barcodeOptions.hasOwnProperty('options')) {
            optionsSelectElement.append(
                new Option("(auto)", "(auto)", selected=(barcodeOptions.default === "(auto)")),
                ...(barcodeOptions.options.map(o=>new Option(o, o, selected=(barcodeOptions.default === o))))
            );
        } else if (barcodeOptions.hasOwnProperty('optionsformatpairings')) {
            optionsSelectElement.append(
                new Option("(auto)", "(auto)", selected=(barcodeOptions.default === "(auto)")),
                ...Object.entries(barcodeOptions.optionsformatpairings).map(([k, v])=>{
                    let optgroup = Object.assign(document.createElement('optgroup'), { 'label': `Format: ${k}` });
                    optgroup.append(...(v.map(o=>new Option(o, o, selected=(barcodeOptions.default === o)))));
                    return optgroup;
                })
            );
        } else {
            window.writeToLog("Error - No barcode options detected.", true);
        }
    } else {
        // Does not have barcode options - disable optionsSelectElement & clear it in miscOptions
        optionsSelectElement.options.add(new Option("(auto)", "(auto)", true, true))
    }
};