var $throbber = $('<img src="/img/ajax-loader.gif>').attr("alt", "Loading...");

var FLYMINE = 'http://www.flymine.org/query';
var RATMINE = 'http://ratmine.mcw.edu/ratmine';
var METABOLIC = 'http://www.metabolicmine.org/beta';


function getButtonClickHandler(symbol, org) { return function() {
    var $box = $('#choose-gene').children().fadeOut();
    var allOrgs = ["D. melanogaster", "H. sapiens", "R. norvegicus"];
    var otherOrgs = [];
    var i = 0;
    for (i in allOrgs) {
        if (allOrgs[i] != org) {
            otherOrgs.push(allOrgs[i]);
        }
    }
    $('#data').css("opacity", 0.5);
    $box.fadeOut();
    // Use FlyMine to query for homologues
    IMBedding.loadQuery(
        {
            select: ["Gene.symbol", "Gene.organism.shortName"],
            from: "genomic",
            where: [
                {path: "Gene.symbol", op: "=", value: symbol},
                {path: "Gene.homologues.homologue", op: "LOOKUP", value: symbol},
                {path: "Gene.organism.shortName", op: "ONE OF", values: otherOrgs}
            ],
            constraintLogic: "A or (B and C)"
        },
        {format: "jsonpobjects"},
        function(resultset) {
            var i = 0;
            var gene;
            var orgToSymbol = {};
            for (i in resultset.results) {
                gene = resultset.results[i];
                if (!orgToSymbol[gene.organism.shortName]) {
                    orgToSymbol[gene.organism.shortName] = [];
                }
                orgToSymbol[gene.organism.shortName].push(gene.symbol);
            }
            loadTables(orgToSymbol);
        },
        {
            baseUrl: FLYMINE
        }
    );
}}

$(function() {
    $('#choose-gene-name').focus();
    $('#submit-gene-name').click(function() {$('#choose-gene-name').change()});
    $('#choose-gene-name').change(function() {
        var symbol = $(this).val();
        var orgName = $('#organism-name').val();
        $throbber.insertBefore('#data').show();
        var url;
        if (orgName == "D. melanogaster") {
            url = FLYMINE;
        } else if (orgName == "R. norvegicus") {
            url = RATMINE;
        }else {
            url = METABOLIC;
        }
        $('.gene-labels').empty();
        IMBedding.loadQuery(
            {
                select: ["Gene.symbol", "Gene.name", "Gene.primaryIdentifier", 
                         "Gene.organism.shortName"],
                from: "genomic",
                where: [
                    {path: "Gene", op: "LOOKUP", value: symbol},
                    {path: "Gene.organism.shortName", op: "=", value: orgName}
                ]
            },
            {format: "jsonpobjects"},
            function(resultset) {
                var $box = $('#choose-gene').empty().append("<h3>Choose One</h3>");
                var genes = resultset.results;
                var gene, $button, i;

                for (i in genes) {
                    var gene = genes[i];
                    var $button = $('<a href="#">').addClass("gene-chooser").css("display", "none");
                    var text = gene.symbol + " (" + gene.primaryIdentifier + ") " + 
                               gene.organism.shortName;
                    if (gene.symbol == symbol || gene.name == symbol) {
                        $button.addClass("best-answer");
                    }
                    $button.text(text);
                    var handler = getButtonClickHandler(gene.symbol, gene.organism.shortName);
                    $button.click(handler);
                    if (genes.length == 1) {
                        $button.click();
                    } else {
                        $box.append($button);
                        $button.fadeIn();
                    }
                }
            },
            {
                baseUrl: url
            }
        );
    });
});

function loadTables(orgToSymbol, orgToGene) {
    $throbber.hide();
    $('#data').css("opacity", 1);
    loadFly(orgToSymbol);
    loadRat(orgToSymbol);
    loadMeta(orgToSymbol);
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
    if (base == METABOLIC) {
        query.select.push("Gene.summary");
    }
    IMBedding.loadQuery(query, {format: "jsonpobjects"}, function(resultset) {
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
            if (base == METABOLIC) {
                if (gene.summary) {
                    $p.append("<span class='summary-text'>" + gene.summary + "</span>");
                    $p.click(function() {$(this).children('.summary-text').slideToggle()});
                }
            }
            $(selector).append($p);
        }
    }, {baseUrl: base});
}

function loadFly(orgToSymbol, orgToGene) {
    var org = "D. melanogaster";
    $('#fly-data').css("opacity", 0.5);
    var symbols = orgToSymbol[org];
    if (symbols) {
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
            '#flymine-go-table',
            {
                baseUrl: FLYMINE
            }
        );
        IMBedding.loadTemplate(
            {
                // Search for GO annotations for a particular gene.
                name:          "Gene_Pathway",

                // Show GO annotations for gene:
                constraint1:   "Gene",
                op1:           "LOOKUP",
                value1:        orgToSymbol[org].join(", "),
                extra1:        org,
                code1:         "A"
            },
            '#flymine-pw-table',
            {
                baseUrl: FLYMINE, afterBuildTable: function() {$('#fly-data').css("opacity", 1);}
            }
        );
    } else {
        $('#fly-data').css("opacity", 1);
        $('.flymine-table').html("<p class='apology-placeholder'>No " + org + " homologues found</p>");
    }

}

function loadRat(orgToSymbol) {
    var org = "R. norvegicus";
    $('#rat-data').css("opacity", 0.5);
    var symbols = orgToSymbol[org];
    if (symbols) {
        displayGenes('#rat-genes', org, orgToSymbol, RATMINE);
        IMBedding.loadTemplate(
            {
                // Returns a list of publications that reference a selected gene
                name:          "gene_to_doterms",

                // Find the publications referencing gene:
                constraint1:   "Gene",
                op1:           "LOOKUP",
                value1:        orgToSymbol[org].join(", "),
                extra1:        org,
                code1:         "A"
            },
            '#ratmine-table',
            {baseUrl: RATMINE, afterBuildTable: function() {$('#rat-data').css("opacity", 1);}}
        );
    } else {
        $('#rat-data').css("opacity", 1);
        $('#ratmine-table').html("<p class='apology-placeholder'>No " + org + " homologues found</p>");
    }
}

function loadMeta(orgToSymbol) {
    var org = "H. sapiens";
    displayGenes('#meta-genes', org, orgToSymbol, METABOLIC);
    var i, symbol;
    var $tables = $('#metabolicmine-table').empty();
    var symbols = orgToSymbol[org];
    if (symbols) {
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
                {baseUrl: METABOLIC}
            );
        }
    } else {
        $('#metabolicmine-table').html("<p class='apology-placeholder'>No " + org + " homologues found</p>");
    }
}

