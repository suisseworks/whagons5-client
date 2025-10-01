import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/animate-ui/primitives/radix/collapsible';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel
} from '@/components/ui/sidebar';
import { createSwapy, SlotItemMapArray, Swapy, utils } from 'swapy'
import { useEffect, useMemo, useRef, useState } from 'react';


type Item = {
  id: string
  title: string
}


const initialItems: Item[] = [
  { id: '1', title: '1' },
  { id: '2', title: '2' },
  { id: '3', title: '3' },
]


export function AppSidebarDummy() {


  const [items, setItems] = useState<Item[]>(initialItems)
  const [slotItemMap, setSlotItemMap] = useState<SlotItemMapArray>(utils.initSlotItemMap(items, 'id'))
  const slottedItems = useMemo(() => utils.toSlottedItems(items, 'id', slotItemMap), [items, slotItemMap])
  const swapyRef = useRef<Swapy | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => utils.dynamicSwapy(swapyRef.current, items, 'id', slotItemMap, setSlotItemMap), [items])


  useEffect(() => {
    swapyRef.current = createSwapy(containerRef.current!, {
      manualSwap: true,
      // animation: 'dynamic'
      // autoScrollOnDrag: true,
      // swapMode: 'drop',
      // enabled: true,
      // dragAxis: 'x',
      // dragOnHold: true
    })

    swapyRef.current.onSwap((event) => {
      setSlotItemMap(event.newSlotItemMap.asArray)
    })

    return () => {
      swapyRef.current?.destroy()
    }
  }, [])




  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild className="text-sm font-normal">
          <div className="flex items-center w-full pr-3 transition-all duration-300 justify-between">
            <CollapsibleTrigger className="flex items-center cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-sm p-1 pr-2 -ml-3 transition-all duration-300 justify-start flex-1">
              <FontAwesomeIcon
                icon={faChevronDown}
                className="transition-transform duration-200 ease-out group-data-[state=open]/collapsible:rotate-180 w-4 h-4 text-sidebar-foreground"
              />
              <span className="text-base font-semibold pl-2 text-sidebar-foreground flex items-center">
                Quick Links
              </span>
            </CollapsibleTrigger>
          </div>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarGroupContent className="px-3 py-2 text-sm space-y-2">
            <div className="container" ref={containerRef}>
              <div className="items">
                {slottedItems.map(({ slotId, itemId, item }) => (
                  <div className="slot" key={slotId} data-swapy-slot={slotId}>
                    {item &&
                      <div className="item" data-swapy-item={itemId} key={itemId}>
                        <span>{item.title}</span>
                        <span className="delete" data-swapy-no-drag onClick={() => {
                          setItems(items.filter(i => i.id !== item.id))
                        }}></span>
                      </div>
                    }
                  </div>
                ))}
              </div>
            </div>

          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export default AppSidebarDummy;
