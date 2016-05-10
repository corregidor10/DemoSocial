'use strict';

var posts = [];

var resultados = [];

function getQueryStringParameters(requestedParameter) {

    var param = document.URL.split("?")[1].split("&");

    var strParams = "";

    for (var i = 0; i < param.LENGTH; i++) {
        var actual = param[i].split("=");

        if (actual[0] == requestedParameter) {
            return actual[1];
        }


    }

}

var appWebUrl = decodeURIComponent(getQueryStringParameters("SPAppWebUrl"));


var hostWebUrl = decodeURIComponent(getQueryStringParameters("SPHostUrl"));

var clientContext = new SP.ClientContext.get_current();

var hostContext = SP.AppContextSite(clientContext, hostWebUrl);


var formDigest = "";//necesito el formDigest para las operaciones de escritura



var getFormDigest = function () {
    $.ajax({
        url: appWebUrl + "/_api/contextinfo",
        type: "POST",
        contentType: "application/json; odata=verbose",
        headers: { 'accept': 'application/json; odata=verbose' },
        success: function (data) {
            formDigest = data.d.GetContextWebInformation.FormDigestValue;
        },
        error: function (xhr) {
            alert(xhr.responseText);
            },
        async: false

    });
}
();

var getActorInfo = function (cuenta) {
    var actor = "";
    //Necesitamos recuperar el nombre de cuenta, si tiene tuberías (office 365)cojo la 2posicion del array
    if (cuenta.indexOf("|") >= 0) {
        cuenta = cuenta.split("|")[2];
    }
    $.ajax({
        url: appWebUrl + "/_api/social.feed/actor(item='" + cuenta + "')",
      headers: { 'accept': 'application/json; odata=verbose' },
        success: function (data) {
            actor = data.d.FollowableItemActor;

        },

        error: function (xhr) {

            alert("Error " + xhr.responseText);

        },
        async: false
    });

    return actor;

}

var getSiteFeed = function () {

    var feed;

    $.ajax({
        url: appWebUrl + "/_api/social.feed/actor(item=@v)/feed?@v='" + hostWebUrl + "/newsfeed.aspx'",
        headers: { 'accept': 'application/json; odata=verbose' },
        success: function (data) {
            feed = getFeeds(data);
        },

        error: function (xhr) {
            alert("Error " + xhr.responseText);
        }
    });

    return feed;

}


function getFeeds(data) {

    // recupero los post del array y los ordeno de mas reciente a mas antiguo
    posts = data.d.SocialFeed.Threads.results.reverse();
    var query = "(ContentTypeId:0x01FD4FB0210AB50249908EAA47E6BD3CFE8B* OR " +
       "ContentTypeId:0x01FD59A0DF25F1E14AB882D2C87D4874CF84* OR " +
       "ContentTypeId:0x012002* OR ContentTypeId:0x0107* OR " +
       "WebTemplate=COMMUNITY)";

    var keyWordQuery = new Microsoft.SharePoint.Client.Search.Query.KeywordQuery(clientContext);

    keyWordQuery.set_queryText(query);

    var lista = keyWordQuery.get_sortList();

    lista.add("LastModifiedTime", Microsoft.SharePoint.Client.Search.Query.SortDirection.Ascending);

    keyWordQuery.set_enableSorting(true);

    var executor = new Microsoft.SharePoint.Client.Search.Query.SearchExecutor(clientContext);

    var results = executor.executeQuery(keyWordQuery);

    clientContext.executeQueryAsync(function () {
        resultados = results.m_value.ResultTables[0].ResultRows;

        updateDisplay();


    },
        function (e) {

            alert("Error");

        });

}


var updateDisplay = function () {
    var postB;
    var post;
    var contenido = "<ul>";
    var autor;


    while (posts.length != 0 || resultados.length != 0) {
        if (posts.length == 0) {
            postB = resultados[resultados.length - 1];
            autor = getActorInfo(postB.PostAuthor);
            contenido += addToFeed(autor, postB.FullPostBody, postB.Created);
            resultados.pop();

        }
        else if (resultados.length == 0) {
            post = posts[posts.length - 1].RootPost;
            autor = posts[posts.length - 1].Actors.results[post.Author];

            contenido += addToFeed(autor, post.Text, new Date(post.CreatedTime));

            posts.pop();
        }
        else {
            postB = resultados[resultados.length - 1];
            post = posts[posts.length - 1].RootPost;
            if (new Date(post.CreatedTime) > postB.Created) {
                autor = posts[posts.length - 1].Actors.results[post.Author];

                contenido += addToFeed(autor, post.FullPostBody, new Date(post.CreatedTime));

                posts.pop();
            } else {

                postB = resultados[resultados.length - 1];
                autor = getActorInfo(postB.PostAuthor);
                contenido += addToFeed(autor, postB.FullPostBody, postB.Created);
                resultados.pop();

            }

        }
    }

    contenido += "</ul>";
    $("#posts").html(contenido);

}

function addToFeed(autor, texto, fecha) {

    var contenido = "<li>" + autor.Name + "<br/>" + texto + "<br/>" + fecha + "</li>";

    return contenido;

}


function sendPost() {

    var contenido = $("#mensaje").val();
    contenido += " #PostApp";

    var ca = contenido.split(" ");
    var tagg = [];
    var tc = 0;

    $.each(ca,
        function (i, data) {
            if (data.indexOf("#") == 0) {
                var t = new SP.Social.SocialDataItem();
                t.ItemType = 3;
                t.Text = data;
                tagg.push(t);
                ca[i] = "{" + tc + "}";
                tc++;
            }
        });
    contenido = "";

    $.each(ca, function (i, data) {

        if (i>0)
        {
            contenido += " ";
        }

        contenido += data;
    });



    $.ajax({
        url: appWebUrl + "/_api/social.feed/actor(item=@v)/feed/post?@v='" + hostWebUrl + "/newsfeed.aspx'",
        type: "POST",
        data: JSON.stringify({
            "restCreationData": {
                "__metadata": {
                    "type": "SP.Social.SocialRestPostCreationData"
                },
                "ID": null,
                "creationData": {
                    "__metadata": { "type": "SP.Social.SocialPostCreationData" },
                    "ContentItems": {
                        "results":tagg
                    },
                    "ContentText": contenido,
                    "UpdateStatusText": false
                }
            }
        }),
        headers: {
            'accept': 'application/json; odata=verbose',
            "content-type": "application/json; odata=verbose",
            "X-RequestDigest": formDigest
        },
        success: getSiteFeed,

        error: function () {
            alert("Reventó");
        }
    });


}



$(document).ready(function() {
    getSiteFeed();
    $("#enviar").click(sendPost());



})






