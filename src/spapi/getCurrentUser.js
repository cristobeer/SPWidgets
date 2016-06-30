define([
    "../sputils/apiFetch",
    "../sputils/cache",
    "./getSiteWebUrl",
    "./searchPrincipals",

    "vendor/jsutils/es7-fetch",
    "vendor/jsutils/objectExtend",
    "vendor/jsutils/es6-promise",
    "vendor/jsutils/parseHTML",

    "vendor/domutils/domFind"
], function(
    apiFetch,
    cache,
    getSiteWebUrl,
    searchPrincipals,

    fetchPolyfill,
    objectExtend,
    Promise,
    parseHTML,

    domFind
){
    /* globals _spPageContextInfo  */

    var
    fetch           = fetchPolyfill.fetch,
    PROMISE_CATCH   = "catch",
    consoleLog      = console.log.bind(console),  // jshint ignore:line

    /**
     * Returns a `UserProfileModel` that represents the currently logged in user.
     *
     * @param {Object} [options]
     * @param {String} [options.webURL=Current_Site]
     *
     * @return {Promise<UserProfileModel, Error>}
     *  Promise is resolved with an UserProfileModel.
     *
     *  // FIXME: backward compatibility:
     *      userLoginName
     *      userId
     *
     */
    getCurrentUser = function(options){
        var
        cacheId     = "getCurrentUserData",
        opt         = objectExtend({}, getCurrentUser.options, options),
        reqPromise  =  Promise.resolve()
            .then(function(){
                if (cache.isCached(cacheId)) {
                    return cache.get(cacheId);
                }

                cache(cacheId, reqPromise);

                return searchUserPrincipals(opt);

            })[PROMISE_CATCH](function(e){
                consoleLog(e);
                return scrapeUserDisplayPage(opt);

            // Unable to get current user
            })[PROMISE_CATCH](function(e){
                consoleLog(e); // jshint ignore:line
                return Promise.reject(new Error("Unable to get current user info."));
            });

        return reqPromise;
    };

    /**
     * Uses the searchPrincipals to try to identify the current user using
     * the userLoginName information from `_spPageContextInfo.userLoginName`
     *
     * @private
     *
     * @param {Object} opt
     *
     * @returns {Promise<UserProfileModel, Error>}
     */
    function searchUserPrincipals(opt) {

        // Possible second approach?: use 'GetUserInfo' service which accepts a loginName?
        //      API: https://msdn.microsoft.com/en-us/library/ms774637.aspx

        return new Promise(function(resolve, reject){
            if (
                typeof _spPageContextInfo               === "undefined" ||
                typeof _spPageContextInfo.userLoginName === "undefined" ||
                typeof _spPageContextInfo.userId        === "undefined"
            ) {
                reject(new Error('Unable to searchPrincipals for user. Needed info not in _spPageContextInfo'));
                return;
            }

            var userId          = String(_spPageContextInfo.userId),
                userLoginName   = _spPageContextInfo.userLoginName;

            searchPrincipals({
                searchText: userLoginName,
                webUrl:     opt.webURL
            })
            .then(function(results){
                var userProfile;

                results.some(function(user){
                    if (String(user.ID) === userId) {
                        userProfile = user;
                        return true;
                    }
                });

                if (!userProfile) {
                    reject(new Error("User not found via searchPrincipals"));
                    return;
                }

                resolve(userProfile);

            })[PROMISE_CATCH](function(e){
                reject(e);
            });
        });
    }

    /**
     * Same approach as SPServices - screen scrape the user Display page.
     *
     * @private
     *
     * @return {Promise}
     */
    function scrapeUserDisplayPage(opt) {
        // NOTE:
        // Although the API differs, this method implementation borrows heavily from
        // SPServices.SPGetCurrentUser (http://spservices.codeplex.com/)

        return getSiteWebUrl(opt.webURL).then(function(webURL){

            return fetch(webURL + "/_layouts/userdisp.aspx?Force=True&" + (new Date()).getTime())
                .then(function(response){
                    return response.text().then(function(responseString){
                        return parseHTML(responseString);
                    });
                })
                .then(function(contentDocFrag){
                    var userInfo = {};

                    domFind(contentDocFrag, "table.ms-formtable td.ms-formbody").forEach(function($td){
                        var
                        tdInnerHtml     = $td.innerHTML,
                        reInternalName  = /FieldInternalName="(.+?)"/i,
                        reFieldType     = /FieldType="(.+?)"/i,
                        internalName    = reInternalName.exec(tdInnerHtml),
                        fieldType       = reFieldType.exec(tdInnerHtml),
                        key, value, $child;

                        // If we found an internal name, then use that as the key
                        if (internalName) {
                            key = internalName[1];

                        // ELSE, use the visible label on the page
                        } else {
                            key = $td.previousSibling.textContent.trim();
                        }

                        fieldType = (fieldType ? fieldType[1] : "");

                        // Get the value for this field
                        switch (fieldType) {
                            case "SPFieldNote":
                                $child = $td.querySelector("div");
                                if ($child) {
                                    value = $child.innerHTML;
                                }
                                break;

                            case "SPFieldURL":
                                $child = $td.querySelector("img");
                                if ($child) {
                                    value = $child.getAttribute("src");
                                }
                                break;

                            default:
                                value = $td.textContent;
                                break;
                        }

                        userInfo[key] = (value || "").trim();
                    });


                    // If no ID, then get it from the Edit link
                    if (!userInfo.hasOwnProperty("ID")) {

                        domFind(contentDocFrag, "table.ms-toolbar a[id*='EditItem']").some(function(ele){
                            var idMatch = (/ID=(\d*)/i).exec(ele.href);
                            if (idMatch) {
                                userInfo.ID = idMatch[1];
                                return true;
                            }
                        });
                    }


                    if (userInfo.ID) {
                        // FIXME: need to use getUserProfile now to get good profile

                        return userInfo;
                    }

                    return Promise.reject(new Error("Unable to get ID from scraping userdisp.aspx."));

                    // EXAMPLE OF DATA RETRIEVED FROM SCRAPE:
                    //{
                    //    "Name": "i:0#.f|membership|joe.doe@sharepoint.com",
                    //    "Title": "Joe Doe",
                    //    "EMail": "joedoe@sharepoint.com",
                    //    "MobilePhone": "",
                    //    "Notes": "<div dir=\"\"></div>&nbsp;",
                    //    "Picture": "https://my.sharepoint.com:443/User%20Photos/Profile%20Pictures/joeDoe.jpg?t=63523359043",
                    //    "Department": "",
                    //    "JobTitle": "",
                    //    "SipAddress": "",
                    //    "FirstName": "joe",
                    //    "LastName": "doe",
                    //    "WorkPhone": "",
                    //    "UserName": "joe.doe@sympraxisconsulting.com",
                    //    "WebSite": "",
                    //    "SPSResponsibility": "",
                    //    "Office": "",
                    //    "SPSPictureTimestamp": "63523359043",
                    //    "SPSPicturePlaceholderState": "",
                    //    "SPSPictureExchangeSyncState": "",
                    //    "Attachments": "",
                    //    "ID": "11"
                    //}

                });
        });
    }


    getCurrentUser.defaults = {
        webURL: null
    };

    return getCurrentUser;

    //------------------------------------------------
    // Other possible approaches
    //------------------------------------------------
    // SP 2013: end point:      /_api/web/currentuser
    //   NOT SURE IF THIS WORKS ON PREM....
    // returns:
    //      <?xml version="1.0" encoding="utf-8"?><entry xml:base="https://sympraxis.sharepoint.com/sites/PT2013/_api/" xmlns="http://www.w3.org/2005/Atom" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:georss="http://www.georss.org/georss" xmlns:gml="http://www.opengis.net/gml"><id>https://sympraxis.sharepoint.com/sites/PT2013/_api/Web/GetUserById(11)</id><category term="SP.User" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme" /><link rel="edit" href="Web/GetUserById(11)" /><link rel="http://schemas.microsoft.com/ado/2007/08/dataservices/related/Groups" type="application/atom+xml;type=feed" title="Groups" href="Web/GetUserById(11)/Groups" /><title /><updated>2016-06-05T15:33:18Z</updated><author><name /></author><content type="application/xml"><m:properties><d:Id m:type="Edm.Int32">11</d:Id><d:IsHiddenInUI m:type="Edm.Boolean">false</d:IsHiddenInUI><d:LoginName>i:0#.f|membership|paul.tavares@sympraxisconsulting.com</d:LoginName><d:Title>Paul Tavares</d:Title><d:PrincipalType m:type="Edm.Int32">1</d:PrincipalType><d:Email>paultavares1@gmail.com</d:Email><d:IsShareByEmailGuestUser m:type="Edm.Boolean">false</d:IsShareByEmailGuestUser><d:IsSiteAdmin m:type="Edm.Boolean">true</d:IsSiteAdmin><d:UserId m:type="SP.UserIdInfo"><d:NameId>10033fff8524baa1</d:NameId><d:NameIdIssuer>urn:federation:microsoftonline</d:NameIdIssuer></d:UserId></m:properties></content></entry>
    // THEN:
    //     Call end point: https://sympraxis.sharepoint.com/sites/PT2013/_api/Web/GetUserById(11)
    // Returns:
    // <?xml version="1.0" encoding="utf-8"?><entry xml:base="https://sympraxis.sharepoint.com/sites/PT2013/_api/" xmlns="http://www.w3.org/2005/Atom" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns:georss="http://www.georss.org/georss" xmlns:gml="http://www.opengis.net/gml"><id>https://sympraxis.sharepoint.com/sites/PT2013/_api/Web/GetUserById(11)</id><category term="SP.User" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme" /><link rel="edit" href="Web/GetUserById(11)" /><link rel="http://schemas.microsoft.com/ado/2007/08/dataservices/related/Groups" type="application/atom+xml;type=feed" title="Groups" href="Web/GetUserById(11)/Groups" /><title /><updated>2016-06-05T15:54:23Z</updated><author><name /></author><content type="application/xml"><m:properties><d:Id m:type="Edm.Int32">11</d:Id><d:IsHiddenInUI m:type="Edm.Boolean">false</d:IsHiddenInUI><d:LoginName>i:0#.f|membership|paul.tavares@sympraxisconsulting.com</d:LoginName><d:Title>Paul Tavares</d:Title><d:PrincipalType m:type="Edm.Int32">1</d:PrincipalType><d:Email>paultavares1@gmail.com</d:Email><d:IsShareByEmailGuestUser m:type="Edm.Boolean">false</d:IsShareByEmailGuestUser><d:IsSiteAdmin m:type="Edm.Boolean">true</d:IsSiteAdmin><d:UserId m:type="SP.UserIdInfo"><d:NameId>10033fff8524baa1</d:NameId><d:NameIdIssuer>urn:federation:microsoftonline</d:NameIdIssuer></d:UserId></m:properties></content></entry>




    // Query User Information List table
    //  COMCERNS:
    //      - Permissions (only site admins have access?
    // FROM:
    //   var user = {};
    //   var query = '<Query><Where><Eq><FieldRef Name="ID" /><Value Type="Counter"><UserID /></Value></Eq></Where></Query>';
    //   var viewFields = '<ViewFields><FieldRef Name="ID" /><FieldRef Name="Name" /><FieldRef Name="EMail" /><FieldRef Name="Department" /><FieldRef Name="JobTitle" /><FieldRef Name="UserName" /><FieldRef Name="Office" /></ViewFields>';
    //
    //   getListItems('', 'User Information List', viewFields, query, function (any, status, jqXhr) {




});