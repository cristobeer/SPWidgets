define([
    "../FilterColumn/FilterColumn",
    "../../LookupField/LookupField",

    "vendor/jsutils/objectExtend",
    "vendor/jsutils/dataStore"
], function (
    FilterColumn,
    LookupField,

    objectExtend,
    dataStore
) {

    var
    PRIVATE = dataStore.stash,

    /**
     * Filter panel lookup field
     *
     * @class FilterColumnLookupField
     * @extends FilterColumn
     *
     * @param {Object} options
     */
    FilterColumnLookupField = /** @lends FilterColumnLookupField.prototype */{
        init: function (options) {
            FilterColumn.prototype.init.call(this,
                objectExtend({}, FilterColumnLookupField.defaults, options)
            );

            var
            inst        = PRIVATE.get(this),
            opt         = inst.opt,
            inputWdg    = inst.inputWdg = LookupField.create({
                column:             opt.column,
                hideLabel:          true,
                hideDescription:    true,
                allowMultiples:     true,
                choicesZIndex:      opt.zIndex
            });

            inputWdg.on("item:selected", this.evalDirtyState.bind(this));
            inputWdg.on("item:unselected", this.evalDirtyState.bind(this));
            inputWdg.appendTo(inst.inputHolder);
            inputWdg.pipe(this, "LookupField:");

            this.setKeywordInfo("");
        },

        getValue: function(){
            return PRIVATE.get(this).inputWdg.getSelected();
        },

        setFilter: function(filter){
            var inst = PRIVATE.get(this);
            inst.setFieldCommonFilters(filter);
            return inst.inputWdg.setSelected(filter.values);
        }
    };

    FilterColumnLookupField = FilterColumn.extend(FilterColumnLookupField);
    FilterColumnLookupField.defaults = {};

    return FilterColumnLookupField;
});