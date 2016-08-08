import SPPeoplePickerDemo   from '../SPPeoplePickerDemo/SPPeoplePickerDemo';
import SPFilterPanelDemo    from '../SPFilterPanelDemo/SPFilterPanelDemo';
import LookupFieldDemo      from '../LookupFieldDemo/LookupFieldDemo';
import DateTimeFieldDemo    from '../DateTimeFieldDemo/DateTimeFieldDemo';

var demoCntr = document.querySelector("#spwidgets_dev_demo"),
    demoSelector = document.querySelector("#demo_selector"),
    currentDemo;

demoSelector.addEventListener("change", function(){
    if (currentDemo) {
        currentDemo.destroy();
        currentDemo = null;
    }

    switch (demoSelector.value) {
        case "SPPeoplePicker":
            currentDemo = SPPeoplePickerDemo.create();
            break;

        case "SPFilterPanel":
            currentDemo = SPFilterPanelDemo.create();
            break;

        case "LookupField":
            currentDemo = LookupFieldDemo.create();
            break;

        case "DateTimeField":
            currentDemo = DateTimeFieldDemo.create();
            break;
    }

    if (currentDemo) {
        currentDemo.appendTo(demoCntr);
    }

});

demoSelector.style.display = "";

