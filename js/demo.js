var $throbber = $('<img src="/img/ajax-loader.gif>').attr("alt", "Loading...");

function getButtonClickHandler(symbol, org) { return function() {
    var $box = $('#choose-gene').children().fadeOut();
    $box.fadeOut();
    IMBedding.loadQuery(
        {
            select: ["Gene.symbol", "Gene.organism.shortName"],
            from: "genomic",
            where: [
                {path: "Gene.homologues.homologue", op: "LOOKUP", value: symbol},
                {path: "Gene.organism.shortName", op: "!=", value: org},
                {path: "Gene.symbol", op: "=", value: symbol},
            ],
            constraintLogic: "(A and B) or C"
        },
        {format: "jsonpobjects"},
        function(resultset) {
            var i = 0;
            var gene;
            var orgToSymbol = {};
            var orgToGene = {};
            for (i in resultset.results) {
                gene = resultset.results[i];
                if (!orgToSymbol[gene.organism.shortName]) {
                    orgToSymbol[gene.organism.shortName] = [];
                    orgToGene[gene.organism.shortName] = [];
                }
                orgToSymbol[gene.organism.shortName].push(gene.symbol);
            }
            console.log(orgToSymbol, orgToGene);
            loadTables(orgToSymbol, orgToGene);
        },
        {
            baseUrl: 'http://www.flymine.org/query',
        }
    );
}}

$(function() {
    $('#choose-gene-name').change(function() {
        var symbol = $(this).val();
        $('#data').fadeOut();
        $throbber.insertBefore('#data').show();
        IMBedding.loadQuery(
            {
                select: ["Gene.symbol", "Gene.name", "Gene.primaryIdentifier", 
                         "Gene.organism.shortName"],
                from: "genomic",
                where: [
                    {path: "Gene", op: "LOOKUP", value: symbol},
                    {path: "Gene.homologues.homologue", op: "LOOKUP", value: symbol},
                ],
                constraintLogic: "A or B",
            },
            {format: "jsonpobjects"},
            function(resultset) {
                var $box = $('#choose-gene').empty().append("<h3>Choose One</h3>");
                var genes = resultset.results;
                var gene, $button, i;
                for (i in genes) {
                    var gene = genes[i];
                    var $button = $('<button>').addClass("gene-chooser").css("display", "none");
                    var text = gene.symbol + " (" + gene.primaryIdentifier + ") " + 
                               gene.organism.shortName;
                    if (gene.symbol == symbol || gene.name == symbol) {
                        $button.addClass("best-answer");
                    }
                    $button.text(text);
                    $button.click(getButtonClickHandler(gene.symbol, gene.organism.shortName));
                    $box.append($button);
                    $button.fadeIn();
                }
            },
            {
                baseUrl: 'http://www.flymine.org/query',
            }
        );
    });
});

function loadTables(orgToSymbol, orgToGene) {
    $throbber.hide();
    $('#data').fadeIn();
    loadFly(orgToSymbol, orgToGene);
}

function displayGenes(selector, org, orgToSymbol, base) {
    var query = {
        select: ["Gene.symbol", "Gene.name", "Gene.primaryIdentifier", "Gene.length", 
                "Gene.chromosomeLocation.start", "Gene.chromosomeLocation.end", 
                "Gene.chromosomeLocation.strand", "Gene.chromosome.primaryIdentifier"],
        from: "genomic",
        where: [
            {path: "Gene.symbol", op: "ONE OF", values: orgToSymbol[org]}
        ]
    };
    IMBedding.loadQuery(query, {format: "jsonpobjects"}, function(resultset) {
        console.log("Running" + org);
        var genes = resultset.results;
        var i, gene, $p;
        $(selector).empty();
        for (i in genes) {
            $p = $('<p>').addClass("gene-summary");
            gene = genes[i];
            var text = gene.symbol + " (";
            if (gene.name) {
                text += gene.name;
            } else {
                text += gene.primaryIdentifier;
            }
            text += ") ";
            text += gene.chromosome.primaryIdentifier + ":" +
                    gene.chromosomeLocation.start + ".." + 
                    gene.chromosomeLocation.end + " " + gene.chromosomeLocation.strand;
            $p.text(text);
            console.log(text);
            $(selector).append($p);
        }
    }, {baseUrl: base});
}

function loadFly(orgToSymbol, orgToGene) {
    var org = "D. melanogaster";
    displayGenes('#fly-genes', org, orgToSymbol, 'http://www.flymine.org/query');
    IMBedding.loadTemplate(
        {
            // Search for GO annotations for a particular gene.
            name:          "Gene_GO",

            // Show GO annotations for gene:
            constraint1:   "Gene",
            op1:           "LOOKUP",
            value1:        orgToSymbol[org].join(", "),
            extra1:        org,
            code1:         "A"
        },
        '#flymine-table',
        {
            baseUrl: 'http://www.flymine.org/query',
            afterBuildTable: function() { loadMod(orgToSymbol, orgToGene) }
        }
    );

}

function loadMod(orgToSymbol) {
    var org = "D. melanogaster";
    IMBedding.loadTemplate(
        {
            // Returns a list of publications that reference a selected gene
            name:          "Gene_Submissions",

            // Find the publications referencing gene:
            constraint1:   "Gene",
            op1:           "LOOKUP",
            value1:        orgToSymbol["D. melanogaster"].join(", "),
            extra1:        "D. melanogaster",
            code1:         "A"
        },
        '#modmine-table',
        {
            baseUrl: 'http://intermine.modencode.org/release-24',
            afterBuildTable: function() { loadMeta(orgToSymbol) }
        }
    );
}

function loadMeta(orgToSymbol) {
    var org = "H. sapiens";
    displayGenes('#meta-genes', org, orgToSymbol, 'http://www.metabolicmine.org/beta');
    var i, symbol;
    var $tables = $('#metabolicmine-table').empty();
    for (i in orgToSymbol[org]) {
        if (!orgToSymbol[org][i]) {
            continue;
        }
        $tables.append('<div id="metabolicmine-table' + i + '">');
        symbol = orgToSymbol[org][i];
        IMBedding.loadTemplate(
            {
                // For a given Gene (or List of Genes) returns associated SNPs found
                // within the Gene or flanking regions. You can specify flanking region
                // direction (upstream or downstream) and flanking distance (0.5, 1.0,
                // 2.0 or 10kb).
                name:          "Gene_SNP",

                constraint1:   "Gene",
                op1:           "LOOKUP",
                value1:        symbol,
                extra1:        org,
                code1:         "D",

                // Direction
                constraint2:   "Gene.flankingRegions.direction",
                op2:           "=",
                value2:        "upstream",
                code2:         "B",

                // Distance
                constraint3:   "Gene.flankingRegions.distance",
                op3:           "=",
                value3:        "1.0kb",
                code3:         "C"
            },
            '#metabolicmine-table' + i,
            {baseUrl: 'http://www.metabolicmine.org/beta'}
        );
    }
}

