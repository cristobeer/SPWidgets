import Widget               from "common-micro-libs/src/jsutils/Widget";
import EventEmitter         from "common-micro-libs/src/jsutils/EventEmitter";
import dataStore            from "common-micro-libs/src/jsutils/dataStore";
import objectExtend         from "common-micro-libs/src/jsutils/objectExtend";
import fillTemplate         from "common-micro-libs/src/jsutils/fillTemplate";
import parseHTML            from "common-micro-libs/src/jsutils/parseHTML";
import domClosest           from "common-micro-libs/src/domutils/domClosest";
import domAddClass          from "common-micro-libs/src/domutils/domAddClass";
import domRemoveClass       from "common-micro-libs/src/domutils/domRemoveClass";
import domAddEventListener  from "common-micro-libs/src/domutils/domAddEventListener"

import PersonaTemplate  from "./Persona.html";
import "./Persona.less";


//----------------------------------------------------------------
var PRIVATE                 = dataStore.create();
var CSS_CLASS_BASE          = 'spwidgets-Persona';
var CSS_CLASS_MS_PERSONA    = 'ms-Persona';
var CSS_CLASS_NO_DETAILS    = `${CSS_CLASS_BASE}--noDetails`;

/**
 * Widget description
 *
 * @class Persona
 * @extends Widget
 *
 * @param {Object} options
 * @param {UserProfileModel} options.userProfile
 * @param {String} [options.presence='offline']
 *
 * @fires Persona#click
 * @fires Persona#photo-load-failed
 * @fires Persona#action-click
 */
var Persona = {
    init: function (options) {
        var inst = {
            opt:                objectExtend({}, Persona.defaults, options),
            sizeModifier:       "",
            presenceModifier:   "",
            variant:            ""
        };

        PRIVATE.set(this, inst);

        let opt = inst.opt;

        this._model = opt.userProfile;
        inst.presenceModifier = opt.presence || 'offline';

        let $ui = this.$ui = parseHTML(
            fillTemplate(this.getTemplate(), opt.userProfile)
        ).firstChild;
        let uiFind = $ui.querySelector.bind($ui);

        inst.$imgArea = uiFind("." + CSS_CLASS_MS_PERSONA + "-imageArea");
        // Find the persona element, which might not be the top element,
        // since this widget could have been extended and UI might be wrapped
        // in other elements (ex. people picker)
        inst.$persona = domClosest(inst.$imgArea, `.${CSS_CLASS_MS_PERSONA}`);

        let $userPhotoImg = uiFind(`.${CSS_CLASS_MS_PERSONA}-imageArea img`);
        domAddEventListener($userPhotoImg, "error", handleUserPhotoLoadFailure.bind(this, $userPhotoImg));


        if (opt.size) {
            this.setSize(opt.size);
        }

        if (opt.hideDetails) {
            this.hideDetails();
        }

        if (opt.variant) {
            this.setVariant(opt.variant);
        }

        if (opt.hideAction) {
            domAddClass($ui, `${CSS_CLASS_BASE}--noAction`);
        }

        domAddEventListener(uiFind(`.${CSS_CLASS_MS_PERSONA}-actionIcon`), "click", (ev) => {
            /**
             * User clicked on the Persona's action button
             *
             * @event Persona#action-click
             */
            this.emit("action-click");
            ev.stopPropagation();
        });

        domAddEventListener($ui, "click", () => {
            /**
             * Persona Element was clicked on by user
             *
             * @event Persona#click
             */
            this.emit("click");
        });

        this.onDestroy(function(){
            // Destroy all Compose object
            Object.keys(inst).forEach(function (prop) {
                if (inst[prop]) {
                    // Widgets
                    if (inst[prop].destroy) {
                        inst[prop].destroy();

                    // DOM events
                    } else if (inst[prop].remove) {
                        inst[prop].remove();

                    // EventEmitter events
                    } else if (inst[prop].off) {
                        inst[prop].off();
                    }

                    inst[prop] = undefined;
                }
            });

            PRIVATE['delete'](this);
        }.bind(this));
    },

    /**
     * Get the HTML template for the widget.
     *
     * @returns {String}
     */
    getTemplate: function(){
        return PersonaTemplate;
    },

    /**
     * Returns the user profile this instance of the persona widget.
     *
     * @returns {UserProfileModel}
     */
    getUserProfile: function(){
        return this._model;
    },

    /**
     * Sets the Persona style that should be shown.
     *
     * @param {String} variant
     *  A string with the variant that should be shown. Valid values are:
     *  `circle` (Default), `initials`, `token` and `facePile`
     */
    setVariant: function(variant) {
        const inst = PRIVATE.get(this);
        const $ui = inst.$persona;

        if (inst.variant) {
            domRemoveClass($ui, `${CSS_CLASS_MS_PERSONA}--${inst.variant}`);
        }

        if (variant) {
            domAddClass($ui, `${CSS_CLASS_MS_PERSONA}--${variant}`);
            inst.variant = variant;
        }
    },

    /**
     * Sets the size of the widget.
     *
     * @param {String} size
     *  Valid value are: `tiny`, `xs`, `sm`, `lg`, `xl`
     */
    setSize: function(size){
        if (!size) {
            return;
        }

        var inst            = PRIVATE.get(this),
            $persona        = inst.$persona,
            cssClassName    = CSS_CLASS_MS_PERSONA + "--" + size.toLowerCase();

        if (inst.sizeModifier) {
            domRemoveClass($persona, inst.sizeModifier);
        }

        inst.sizeModifier = cssClassName;
        domAddClass($persona, cssClassName);
    },

    /**
     * Sets the presence of the Persona.
     *
     * @param {String} state
     *  The state to set on the Persona. Possible values are:
     *  `noPresence`, `available`, `away`, `blocked`, `busy`, `dnd` (do not disturb) and `offline` (default).
     */
    setPresence: function(state){
        var inst = PRIVATE.get(this),
            $ui = inst.$persona;

        if (inst.presenceModifier) {
            domRemoveClass($ui, CSS_CLASS_MS_PERSONA + "--" + inst.presenceModifier);
            inst.presenceModifier = "";
        }

        if (state) {
            state = String(state).toLowerCase();
            domAddClass($ui, CSS_CLASS_MS_PERSONA + "--" + state);
            inst.presenceModifier = state;
        }
    },

    /**
     * Replaces the Personal user photo with a new one
     *
     * @param {String} url
     */
    setUserPhoto: function(url){
        let inst        = PRIVATE.get(this);
        let $currentImg = inst.$imgArea.querySelector("img");
        let $imgParent  = $currentImg.parentNode;
        let $newImg     = parseHTML('<img class="ms-Persona-image" src="' + url + '" onerror="this.__loadErrorNotify()">').firstChild;

        domAddEventListener($userPhotoImg, "error", handleUserPhotoLoadFailure.bind(this, $userPhotoImg));
        $imgParent.insertBefore($newImg, $currentImg);
        $imgParent.removeChild($currentImg);
    },

    /**
     * Hides the details (show image only)
     */
    hideDetails: function(){
        showHideDetails.call(this, true);
    },

    /**
     * Shows the details
     */
    showDetails: function(){
        showHideDetails.call(this)
    }
};

/**
 * Show or hides the details area based on the input param
 *
 * @param {Boolean} hide
 */
function showHideDetails(hide) {
    let $ui = this.getEle();

    if (hide) {
        domAddClass($ui, CSS_CLASS_NO_DETAILS);
    } else {
        domRemoveClass($ui, CSS_CLASS_NO_DETAILS);
    }
}

/**
 * Handle failure of user photo
 *
 * @param {DOMElement} $img
 */
function handleUserPhotoLoadFailure($img) {
    $img.style.display = "none";

    /**
     * The user's profile photo failed to load.
     *
     * @event Persona#photo-load-failed
     */
    this.emit("photo-load-failed");
}


Persona = EventEmitter.extend(Widget, Persona);
Persona.defaults = {
    userProfile:    null,
    presence:       "offline",
    variant:        "circle",
    size:           null,
    hideDetails:    false,
    hideAction:     true
};

export default Persona;
