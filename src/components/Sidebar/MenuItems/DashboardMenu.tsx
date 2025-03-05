import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import SidebarLinkGroup from '../SidebarLinkGroup';
import { useLocation } from 'react-router';
import { createSwapy, Swapy } from 'swapy';

interface Props {
  sidebarExpanded: boolean;
  setSidebarExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

interface Dashboard {
  name: string;
  uuid: string;
  slot: number;
}

function DashboardMenu(props: Props) {
  const { sidebarExpanded, setSidebarExpanded } = props;
  const location = useLocation();
  const { pathname } = location;

  const swapyRef = useRef<Swapy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  let layoutConfig: { dashboards: Dashboard[] } =
    getLayoutConfigFromLocalStorage() || { dashboards: [] };

  useEffect(() => {
    // saveLayoutConfigToLocalStorage(layoutConfig)
    if (containerRef.current) {
      swapyRef.current = createSwapy(containerRef.current, {
        // animation: 'dynamic'
        // swapMode: 'drop',
        // autoScrollOnDrag: true,
        // enabled: true,
        // dragAxis: 'x',
        // dragOnHold: true
      });

      // swapyRef.current.enable(false)
      // swapyRef.current.destroy()
      // console.log(swapyRef.current.slotItemMap())

      swapyRef.current.onBeforeSwap((event) => {
        console.log('beforeSwap', event);
        layoutConfig = getLayoutConfigFromLocalStorage() || { dashboards: [] };
        // This is for dynamically enabling and disabling swapping.
        // Return true to allow swapping, and return false to prevent swapping.
        return true;
      });

      swapyRef.current.onSwapStart((event) => {
        console.log('start', event);
      });
      swapyRef.current.onSwap((event) => {
        console.log('swap', event);
      });
      // swapyRef.current.onSwapEnd((event) => {
      //   console.log('end', event);
      //   //use the as array to switch indexs in the layoutconfig
      //   const asArray = event.slotItemMap.asArray;
      //   const newOrder = new Array(layoutConfig.dashboards.length);
      //   for (let item in asArray) {
      //     const itemIndex = asArray[item].item;
      //     const slotIndex = asArray[item].slot;
      //     console.log(itemIndex, slotIndex);
      //     const dashboard = layoutConfig.dashboards[Number(itemIndex)];
      //     if (dashboard) {
      //       newOrder[Number(slotIndex)] = dashboard;
      //     }
      //   }
      //   layoutConfig.dashboards = newOrder;

      //   console.log(layoutConfig);
      // });
      swapyRef.current.onSwapEnd((event) => {
        console.log('Swap End:', event);

        // Extract the `asArray` structure from Swapy's event
        const asArray = event.slotItemMap.asArray;

        // Dynamically rebuild the order of dashboards
        for (const item of asArray) {
          const itemIndex = item.item;
          const slotIndex = item.slot;
          const dashboard = layoutConfig.dashboards[Number(itemIndex)];
          if (dashboard) {
            dashboard.slot = Number(slotIndex);
            console.log(dashboard);
          }
        }

        // Update the layoutConfig with the rebuilt order

        // Log for debugging purposes
        console.log('Updated LayoutConfig:', layoutConfig);
        //save layoutConfig
        saveLayoutConfigToLocalStorage(layoutConfig);
      });
    }
    return () => {
      swapyRef.current?.destroy();
    };
  }, []);

  //dashboard are in user layoutConfig

  // const layoutConfig = {
  //   dashboards: [
  //     {
  //       name: 'Main Dashboard',
  //       uuid: '123e4567-e89b-12d3-a456-426614174000',
  //       slot: 0,
  //     },
  //     {
  //       name: 'Secondary Dashboard',
  //       uuid: '123e4567-e89b-12d3-a456-426614174001',
  //       slot: 1,
  //     },
  //   ] as Dashboard[],
  // };

  // Save layoutConfig to localStorage
  function saveLayoutConfigToLocalStorage(config: typeof layoutConfig) {
    localStorage.setItem('layoutConfig', JSON.stringify(config));
  }

  // Retrieve layoutConfig from localStorage
  function getLayoutConfigFromLocalStorage(): typeof layoutConfig | null {
    const storedConfig = localStorage.getItem('layoutConfig');
    return storedConfig ? JSON.parse(storedConfig) : null;
  }

  return (
    <SidebarLinkGroup
      activeCondition={pathname === '/' || pathname.includes('dashboard')}
    >
      {(handleClick, open) => {
        return (
          <React.Fragment>
            <NavLink
              to="#"
              className={`group relative flex items-center gap-2.5 rounded-sm px-4 py-2 font-medium text-bodydark1 duration-300 ease-in-out hover:bg-graydark dark:hover:bg-meta-4 ${
                (pathname === '/' || pathname.includes('dashboard')) &&
                'bg-graydark dark:bg-meta-4'
              }`}
              onClick={(e) => {
                e.preventDefault();
                sidebarExpanded ? handleClick() : setSidebarExpanded(true);
              }}
            >
              <svg
                className="fill-current"
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6.10322 0.956299H2.53135C1.5751 0.956299 0.787598 1.7438 0.787598 2.70005V6.27192C0.787598 7.22817 1.5751 8.01567 2.53135 8.01567H6.10322C7.05947 8.01567 7.84697 7.22817 7.84697 6.27192V2.72817C7.8751 1.7438 7.0876 0.956299 6.10322 0.956299ZM6.60947 6.30005C6.60947 6.5813 6.38447 6.8063 6.10322 6.8063H2.53135C2.2501 6.8063 2.0251 6.5813 2.0251 6.30005V2.72817C2.0251 2.44692 2.2501 2.22192 2.53135 2.22192H6.10322C6.38447 2.22192 6.60947 2.44692 6.60947 2.72817V6.30005Z"
                  fill=""
                />
                <path
                  d="M15.4689 0.956299H11.8971C10.9408 0.956299 10.1533 1.7438 10.1533 2.70005V6.27192C10.1533 7.22817 10.9408 8.01567 11.8971 8.01567H15.4689C16.4252 8.01567 17.2127 7.22817 17.2127 6.27192V2.72817C17.2127 1.7438 16.4252 0.956299 15.4689 0.956299ZM15.9752 6.30005C15.9752 6.5813 15.7502 6.8063 15.4689 6.8063H11.8971C11.6158 6.8063 11.3908 6.5813 11.3908 6.30005V2.72817C11.3908 2.44692 11.6158 2.22192 11.8971 2.22192H15.4689C15.7502 2.22192 15.9752 2.44692 15.9752 2.72817V6.30005Z"
                  fill=""
                />
                <path
                  d="M6.10322 9.92822H2.53135C1.5751 9.92822 0.787598 10.7157 0.787598 11.672V15.2438C0.787598 16.2001 1.5751 16.9876 2.53135 16.9876H6.10322C7.05947 16.9876 7.84697 16.2001 7.84697 15.2438V11.7001C7.8751 10.7157 7.0876 9.92822 6.10322 9.92822ZM6.60947 15.272C6.60947 15.5532 6.38447 15.7782 6.10322 15.7782H2.53135C2.2501 15.7782 2.0251 15.5532 2.0251 15.272V11.7001C2.0251 11.4188 2.2501 11.1938 2.53135 11.1938H6.10322C6.38447 11.1938 6.60947 11.4188 6.60947 11.7001V15.272Z"
                  fill=""
                />
                <path
                  d="M15.4689 9.92822H11.8971C10.9408 9.92822 10.1533 10.7157 10.1533 11.672V15.2438C10.1533 16.2001 10.9408 16.9876 11.8971 16.9876H15.4689C16.4252 16.9876 17.2127 16.2001 17.2127 15.2438V11.7001C17.2127 10.7157 16.4252 9.92822 15.4689 9.92822ZM15.9752 15.272C15.9752 15.5532 15.7502 15.7782 15.4689 15.7782H11.8971C11.6158 15.7782 11.3908 15.5532 11.3908 15.272V11.7001C11.3908 11.4188 11.6158 11.1938 11.8971 11.1938H15.4689C15.7502 11.1938 15.9752 11.4188 15.9752 11.7001V15.272Z"
                  fill=""
                />
              </svg>
              Dashboard
              <svg
                className={`absolute right-4 top-1/2 -translate-y-1/2 fill-current ${
                  open && 'rotate-180'
                }`}
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M4.41107 6.9107C4.73651 6.58527 5.26414 6.58527 5.58958 6.9107L10.0003 11.3214L14.4111 6.91071C14.7365 6.58527 15.2641 6.58527 15.5896 6.91071C15.915 7.23614 15.915 7.76378 15.5896 8.08922L10.5896 13.0892C10.2641 13.4147 9.73651 13.4147 9.41107 13.0892L4.41107 8.08922C4.08563 7.76378 4.08563 7.23614 4.41107 6.9107Z"
                  fill=""
                />
              </svg>
            </NavLink>
            {/* <!-- Dropdown Menu Start --> */}
            <div
              className={`translate transform overflow-hidden ${
                !open && 'hidden'
              }`}
            >
              {/* Dashboards listed here */}
              <div ref={containerRef}>
                <ul className="mt-4 mb-5.5 flex flex-col gap-2.5 pl-6">
                  {layoutConfig.dashboards
                    .slice() // Create a shallow copy of the array to avoid mutating the original
                    .sort((a, b) => a.slot - b.slot) // Sort dashboards by their `slot` property
                    .map((dashboard, index) => (
                      <div data-swapy-slot={index} key={dashboard.uuid}>
                        <li key={dashboard.uuid} data-swapy-item={
                          layoutConfig.dashboards.reduce((_,curr, index)=>{
                              //when current is equal to dashbord return current index
                                if (curr.uuid === dashboard.uuid) {
                                return index;
                                }
                                return 0;
          
                          },0)
                        }>
                          <NavLink
                            to={`/dashboard/${dashboard.uuid}`}
                            className={({ isActive }) =>
                              'group relative flex items-center gap-2.5 rounded-md px-4 font-medium text-bodydark2 duration-300 ease-in-out hover:text-white ' +
                              (isActive && '!text-white')
                            }
                            draggable="false" /* Prevent dragging the link */
                            onDragStart={(e) => e.preventDefault()}
                          >
                            {
                              dashboard.name /* Display dashboard name or similar */
                            }
                          </NavLink>
                        </li>
                      </div>
                    ))}
                </ul>
              </div>

              {/* Dashboards listed here */}
            </div>
            {/* <!-- Dropdown Menu End --> */}
          </React.Fragment>
        );
      }}
    </SidebarLinkGroup>
  );
}

export default DashboardMenu;
