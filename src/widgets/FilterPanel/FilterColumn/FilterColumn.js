import Widget               from "common-micro-libs/src/jsutils/Widget";
import EventEmitter         from "common-micro-libs/src/jsutils/EventEmitter";
import dataStore            from "common-micro-libs/src/jsutils/dataStore";
import objectExtend         from "common-micro-libs/src/jsutils/objectExtend";
import fillTemplate         from "common-micro-libs/src/jsutils/fillTemplate";
import parseHTML            from "common-micro-libs/src/jsutils/parseHTML";
import Promise              from "common-micro-libs/src/jsutils/es6-promise";
import domAddEventListener  from "common-micro-libs/src/domutils/domAddEventListener";
import domAddClass          from "common-micro-libs/src/domutils/domAddClass";
import domRemoveClass       from "common-micro-libs/src/domutils/domRemoveClass";
import domHasClass          from "common-micro-libs/src/domutils/domHasClass";
import domFind              from "common-micro-libs/src/domutils/domFind";
import FilterModel          from "../FilterModel";
import FilterColumnTemplate from "./FilterColumn.html";
import "./FilterColumn.less";

    var
    PRIVATE = dataStore.stash,

    CSS_CLASS_BASE          = "spwidgets-FilterPanel-FilterColumn",
    CSS_CLASS_SHOW_OPTIONS  = CSS_CLASS_BASE + "--showOptions",
    CSS_CLASS_HIDE_INPUT    = CSS_CLASS_BASE + "--hideInput",
    CSS_CLASS_IS_DIRTY      = CSS_CLASS_BASE + "--isDirty",

    /**
     * Base filter column widget with no input; it simply provides the UI and
     * expected API interface for fields displayed in the filter panel.
     * When extending this widget to create specialized columns, ensure that
     * this widget's `init` method is called and that `PRIVATE` points to the
     * shared private data `dataStore.stash`.
     *
     * @class FilterColumn
     * @extends Widget
     * @extends EventEmitter
     *
     * @param {Object} options
     *
     * @param {ListColumnModel} options.column
     *  The column definition or an object defining similar information
     *
     * @fires FilterColumn#up
     * @fires FilterColumn#down
     * @fires FilterColumn#change
     */
    FilterColumn = /** @lends FilterColumn.prototype */{
        init: function (options) {
            var inst = {
                opt:        objectExtend({}, this.getFactory().defaults, options),
                inputWdg:   null, // should store the input widget being used by the filter panel
                // Sets common filters... used with .setFilter()
                setFieldCommonFilters: function(filter) {
                    if (filter.compareOperator) {
                        this.setCompareOperator(filter.compareOperator);
                    }

                    if (filter.logicalOperator) {
                        this.setLogicalOperator(filter.logicalOperator);
                    }

                    if (typeof filter.sortOrder === "string") {
                        this.setSortOrder(filter.sortOrder);
                    }
                }.bind(this)
            };

            PRIVATE.set(this, inst);

            var
            me  = this,
            $ui = me.$ui = parseHTML(
                fillTemplate(FilterColumnTemplate, inst.opt)
            ).firstChild,
            uiFind          = inst.uiFind = $ui.querySelector.bind($ui),
            BASE_SELECTOR   = "." + CSS_CLASS_BASE,
            emit            = me.emit.bind(me),
            evalDirtyState  = me.evalDirtyState.bind(me);

            inst.inputHolder        = uiFind(BASE_SELECTOR + "-input-holder");
            inst.infoKeywords       = uiFind(BASE_SELECTOR + "-info-keywords");
            inst.compareOperator    = uiFind("select[name='compareOperator']");
            inst.logicalOperator    = uiFind("select[name='logicalOperator']");
            inst.sortOrder          = uiFind("select[name='sortOrder']");

            domAddEventListener(uiFind(BASE_SELECTOR + "-info-optLink"), "click", function(){
                me.toggleOptions();
            });

            domAddEventListener(uiFind(BASE_SELECTOR + "-move-up"), "click", function(){
                if ($ui.parentNode && $ui.previousSibling) {
                    $ui.parentNode.insertBefore($ui, $ui.previousSibling);
                }
                /**
                 * The Up arrow was clicked on the Filter column definition
                 *
                 * @event FilterColumn#up
                 */
                emit("up");
            });

            domAddEventListener(uiFind(BASE_SELECTOR + "-move-down"), "click", function(){
                if ($ui.parentNode && $ui.nextSibling) {
                    $ui.parentNode.insertBefore($ui.nextSibling, $ui);
                }
                /**
                 * The Down arrow was clicked on the Filter column definition
                 *
                 * @event FilterColumn#down
                 */
                emit("down");
            });

            domAddEventListener(inst.compareOperator,   "change", evalDirtyState);
            domAddEventListener(inst.sortOrder,         "change", evalDirtyState);
            domAddEventListener(inst.logicalOperator,   "change", evalDirtyState);

            this.onDestroy(function () {
                Object.keys(inst, function(instProp){
                    if (inst[instProp] && inst[instProp].destroy ) {
                        inst[instProp].destroy();
                    }
                });
                PRIVATE.delete(me);
            });
        },

        /**
         * Toggles the Column options visibility on and off
         */
        toggleOptions: function () {
            var $ui = this.getEle();

            if (domHasClass($ui, CSS_CLASS_SHOW_OPTIONS)) {
                domRemoveClass($ui, CSS_CLASS_SHOW_OPTIONS);

            } else {
                domAddClass($ui, CSS_CLASS_SHOW_OPTIONS);
            }
        },

        /**
         * Hides the link on the Filter Column that allows
         * the user to show/hide the filter options
         */
        hideOptionsToggle: function(){
            domAddClass(this.getEle(), CSS_CLASS_BASE + "--noOptionsToggle");
        },

        /**
         * returns an array of keywords from the value entered.
         *
         * @return {Array<String>}
         */
        getKeywords: function() {
            return this.getValue();
        },

        /**
         * Returns an object with the keywords the user entered
         * along with matching and sorting options.
         *
         * @return {FilterModel}
         */
        getFilter: function(){
            var inst = PRIVATE.get(this);

            return FilterModel.create(
                {
                    logicalOperator:    inst.logicalOperator.value,
                    compareOperator:    inst.compareOperator.value,
                    sortOrder:          inst.sortOrder.value,
                    input:              this.getValue(),
                    values:             this.getKeywords()
                },
                { column: inst.opt.column }
            );
        },

        /**
         * Returns the value currently defined for the input displayed
         * inside of the FilterColumn
         *
         * @return {String|Array}
         *  Depending on the type of column, getValue will either be a
         *  `String` or `Array`
         */
        getValue: function(){
            var inst = PRIVATE.get(this);

            if (inst.inputWdg && inst.inputWdg.getValue) {
                return inst.inputWdg.getValue();
            }

            return "";
        },

        /**
         * Sets the filter with the default values. Any of the values provided by
         * FilterModel can be set.
         *
         * @param {Object} filter
         *
         * @returns {Promise}
         */
        setFilter: function (filter) {
            var inst = PRIVATE.get(this);

            inst.setFieldCommonFilters.call(this, filter);

            var response = Promise.resolve();

            // If the actual input widget has a `setValue` method and values
            // were provided on input, then call it.
            if (filter && inst.inputWdg.setValue) {
                response = response.then(
                    inst.inputWdg.setValue(
                        Array.isArray(filter.values) ? filter.values.join(inst.opt.delimiter) : filter.values
                    )
                );
                this.evalDirtyState();
            }

            return response;
        },

        /**
         * Sets the text displayed below the input field.
         *
         * @param {String} message
         */
        setKeywordInfo: function(message){
            var inst = PRIVATE.get(this);
            inst.infoKeywords.textContent = String(message);
        },

        /**
         * checks if the filter column is dirty - either it has a value entered or
         * Sort order was set
         *
         * @return {Boolean}
         */
        isDirty: function(){
            return domHasClass(this.getEle(), CSS_CLASS_IS_DIRTY);
        },

        /**
         * Selects the given logical operator on the widget.
         *
         * @param {String} internalLogicalOperator
         */
        setLogicalOperator: function(internalLogicalOperator) {
            var logicalOperator = PRIVATE.get(this).logicalOperator;
            logicalOperator.value = internalLogicalOperator;
            this.evalDirtyState();
        },

        /**
         * Selects the given sort order on the widget.
         *
         * @param {String} internalSortOrder
         */
        setSortOrder: function(internalSortOrder){
            var sortOrder = PRIVATE.get(this).sortOrder;
            sortOrder.value = internalSortOrder;
            this.evalDirtyState();
        },

        /**
         * Adds comparison operators to the column's dropdown.
         *
         * @param {Array<Object>} operators
         */
        addCompareOperators: function(operators){
            var compareOperator     = PRIVATE.get(this).compareOperator,
                newOperatorsHtml    = operators.reduce(function(html, operator){
                html += "<option value=\"" + operator.value + "\">" + operator.title + "</option>";
                return html;
            }, "");

            compareOperator.appendChild(parseHTML(newOperatorsHtml));
        },

        /**
         * Removes a list of compare operators from the list
         *
         * @param {Array<String>|String} operators
         *  An array with the internal (`value`) value of the operators to be removed.
         */
        removeCompareOperators(operators) {
            let compareOperator = PRIVATE.get(this).compareOperator;
            let domSelector     = (Array.isArray(operators) ? operators : [operators]).reduce((selector, operator) => {
                if (operator) {
                    if (selector) {
                        selector += ",";
                    }
                    selector += `option[value='${ operator }']`
                }
                return selector;
            }, "");
            let selectorOptionElements = domFind(compareOperator, domSelector);
            selectorOptionElements.forEach( optionEle => optionEle.parentNode.removeChild(optionEle));
        },

        /**
         * Selects the given comparison operator on the widget.
         *
         * @param {String} internalOperatorName
         */
        setCompareOperator: function(internalOperatorName){
            var compareOperator     = PRIVATE.get(this).compareOperator,
                $ui = this.getEle();
            compareOperator.value = internalOperatorName;

            if (internalOperatorName === "IsNull" || internalOperatorName === "IsNotNull") {
                domAddClass($ui, CSS_CLASS_SHOW_OPTIONS);
                domAddClass($ui, CSS_CLASS_HIDE_INPUT);

            } else {
                domRemoveClass($ui, CSS_CLASS_HIDE_INPUT);
            }

            this.evalDirtyState();
        },

        /**
         * Changes the default operator on the given value and then sets that value as the selected one.
         *
         * @param internalOperatorName
         */
        setCompareOperatorDefault: function (internalOperatorName) {
            var compareOperator     = PRIVATE.get(this).compareOperator;
            domFind(compareOperator, "option").forEach(function(option){
                if (option.value === internalOperatorName) {
                    option.setAttribute("selected", "selected");
                    compareOperator.value = internalOperatorName;

                } else {
                    option.removeAttribute("selected");
                }
            });
        },

        /**
         * Evaluates the filter column and set the dirty state on it if
         * it finds that it has been changed.
         *
         * @returns {boolean}
         */
        evalDirtyState: function() {
            var inst                    = PRIVATE.get(this),
                compareOperatorValue    = inst.compareOperator.value,
                isCompareOperatorDirty  = compareOperatorValue === "IsNull" || compareOperatorValue === "IsNotNull",
                isSortOrderDirty        = !!inst.sortOrder.value,
                $ui                     = this.getEle(),
                val                     = this.getValue(),
                triggerChange           = function(){
                    /**
                     * Filter Column was changed.
                     *
                     * @event FilterColumn#change
                     */
                    this.emit("change");
                }.bind(this),
                isUserInputDirty;

            if (typeof val === "string") {
                isUserInputDirty = !!val;

            } else if (Array.isArray(val)) {
                isUserInputDirty = !!val.length;

            } else if (val) {
                isUserInputDirty = true;
            }

            if (!isCompareOperatorDirty) {
                domRemoveClass($ui, CSS_CLASS_HIDE_INPUT);

            } else {
                domAddClass($ui, CSS_CLASS_SHOW_OPTIONS);
                domAddClass($ui, CSS_CLASS_HIDE_INPUT);
            }

            if (isUserInputDirty || isSortOrderDirty || isCompareOperatorDirty) {
                domAddClass($ui, CSS_CLASS_IS_DIRTY);
                triggerChange();
                return true;
            }

            domRemoveClass($ui, CSS_CLASS_IS_DIRTY);
            triggerChange();
            return false;
        }
    };

    FilterColumn = EventEmitter.extend(Widget, FilterColumn);
    FilterColumn.defaults = {
        column:         {},
        inputKeywords:  ""
    };

    export default FilterColumn;
